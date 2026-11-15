#!/bin/bash
set -euo pipefail

python3 - "$@" <<'PY'
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile

stage, web = map(Path, sys.argv[1:3])
expected_live = sys.argv[3]
origin = 'https://hellospheres.com'
prefix = '/spheres-preview/updates'
archive = 'Spheres-Mac-arm64.app.tar.gz'
zip_name = 'Spheres-Mac-arm64.zip'
assets = (zip_name, archive, f'{archive}.sig')


def version_parts(value):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', value):
        raise ValueError(f'Invalid release version: {value}')
    return tuple(map(int, value.split('.')))


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def public(path, *args):
    return subprocess.check_output([
        'curl', '-fsS', '--max-time', '15', '--resolve', 'hellospheres.com:443:127.0.0.1',
        *args, f'{origin}{path}',
    ])


def replace(path, content):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
        pending = Path(temp.name)
        try:
            temp.write(content)
            temp.close()
            pending.chmod(0o644)
            pending.replace(path)
        finally:
            pending.unlink(missing_ok=True)


def promote():
    checksums = {name: sha256(stage / name) for name in (*assets, 'latest.json')}
    checksum_text = ''.join(f'{digest}  {name}\n' for name, digest in checksums.items())
    if (stage / 'SHA256SUMS').read_text() != checksum_text:
        raise ValueError('Staged release checksums do not match')

    candidate = (stage / 'latest.json').read_bytes()
    manifest = json.loads(candidate)
    version = manifest['version']
    version_parts(version)
    asset_route = f'{prefix}/v{version}'
    if manifest['platforms'] != {'darwin-aarch64': {
        'url': f'{origin}{asset_route}/{archive}',
        'signature': (stage / f'{archive}.sig').read_text().strip(),
    }}:
        raise ValueError('Unexpected updater platform, archive URL or signature')

    updates = web / 'updates'
    feed = updates / 'latest.json'
    before = feed.read_bytes()
    live = json.loads(before)['version']
    if version_parts(version) < version_parts(live):
        raise ValueError(f'Refusing to roll back {live} to {version}')
    if version == live and candidate != before:
        raise ValueError(f'Refusing to replace the published manifest for {version}')
    if version != live and live != expected_live:
        raise ValueError(f'Live version changed from {expected_live} to {live}; run again')

    destination = updates / f'v{version}'
    if destination.exists():
        if any(sha256(destination / name) != checksums[name] for name in assets):
            raise ValueError(f'Refusing to replace immutable assets for {version}')
    elif version == live:
        raise ValueError(f'Published assets for {version} are missing')
    else:
        with tempfile.TemporaryDirectory(dir=updates) as temp:
            pending = Path(temp)
            for name in assets:
                shutil.copyfile(stage / name, pending / name)
                (pending / name).chmod(0o644)
            pending.chmod(0o755)
            pending.rename(destination)

    for name in assets:
        size = (destination / name).stat().st_size
        headers = public(f'{asset_route}/{name}', '-I').lower().splitlines()
        if f'content-length: {size}'.encode() not in headers:
            raise ValueError(f'Wrong HTTPS response size for {name}')

    new_link = f'href="{asset_route}/{zip_name}" download'.encode()

    def verify_live():
        if public(f'{prefix}/latest.json') != candidate:
            raise ValueError('HTTPS feed does not match the candidate')
        for route in ('/', '/invite/release-page-check'):
            if new_link not in public(route):
                raise ValueError(f'HTTPS download link did not update on {route}')

    if version == live:
        verify_live()
        print(f'Spheres {version} is already published with these exact files.')
        return

    old_link = f'href="{prefix}/v{live}/{zip_name}" download'.encode()
    size_mb = ((destination / zip_name).stat().st_size + 500_000) // 1_000_000
    originals = {web / name: (web / name).read_bytes() for name in ('home.html', 'index.html')}
    prepared = {}
    for path, page in originals.items():
        if page.count(old_link) + page.count(new_link) != 1:
            raise ValueError(f'Unexpected download link in {path.name}')
        text, changes = re.subn(rb'(macOS 12 or later \xc2\xb7 )\d+ MB', rb'\g<1>' + f'{size_mb} MB'.encode(), page)
        if changes != 1:
            raise ValueError(f'Unexpected download size in {path.name}')
        prepared[path] = text.replace(old_link, new_link)

    originals[feed] = before
    backup = Path(tempfile.mkdtemp(prefix='previous-', dir=stage))
    for path, content in originals.items():
        (backup / path.name).write_bytes(content)

    try:
        for path, content in prepared.items():
            replace(path, content)
        replace(feed, candidate)
        verify_live()
    except BaseException:
        for path, content in reversed(list(originals.items())):
            replace(path, content)
        print(f'Restored the previous feed and download links. Backups are in {backup}.', file=sys.stderr)
        raise
    print(f'Published Spheres {version} and verified HTTPS readback.')


def interrupt(signum, frame):
    raise InterruptedError(f'Interrupted by signal {signum}')


for signum in (signal.SIGHUP, signal.SIGINT, signal.SIGTERM):
    signal.signal(signum, interrupt)

with contextlib.ExitStack() as stack:
    for lock in (stage / 'upload.lock', stage.parent / 'publish.lock'):
        fcntl.flock(stack.enter_context(lock.open('a')), fcntl.LOCK_EX)
    promote()
PY
