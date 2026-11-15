#!/bin/bash
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
preflight=0
if [[ $# == 2 && $1 == --preflight ]]; then
  preflight=1
  version=$2
elif [[ $# == 1 ]]; then
  release=$(cd "$1" && pwd -P)
  version=$(bash "$repo/scripts/verify-spheres-mac.sh" "$release")
else
  printf 'Usage: bash %s RELEASE_DIRECTORY | --preflight VERSION\n' "$0" >&2
  exit 2
fi

origin=https://hellospheres.com
prefix=/spheres-preview/updates
server=${SPHERES_RELEASE_SSH_HOST:?Set SPHERES_RELEASE_SSH_HOST to your deployment SSH destination}
web=${SPHERES_RELEASE_WEB_ROOT:?Set SPHERES_RELEASE_WEB_ROOT to the Spheres web directory}
staging=${SPHERES_RELEASE_STAGING_ROOT:?Set SPHERES_RELEASE_STAGING_ROOT to the existing publish staging directory}
if [[ ! "$server" =~ ^([[:alnum:]][[:alnum:]_.-]*@)?[[:alnum:]][[:alnum:].-]*$ ]]; then
  printf 'Expected an SSH host or user@host for SPHERES_RELEASE_SSH_HOST.\n' >&2
  exit 2
fi
for directory in "$web" "$staging"; do
  if [[ ! "$directory" =~ ^/[A-Za-z0-9_./-]+$ || "$directory/" == *'/../'* || "$directory" == */ ]]; then
    printf 'Expected absolute deployment directories without spaces, parent traversal or trailing slashes.\n' >&2
    exit 2
  fi
done

assets=(Spheres-Mac-arm64.zip Spheres-Mac-arm64.app.tar.gz Spheres-Mac-arm64.app.tar.gz.sig)
scratch=$(mktemp -d)
cleanup() {
  local name
  for name in live.json live-assets served.json page.html; do
    if [[ -f "$scratch/$name" ]]; then rm -- "$scratch/$name"; fi
  done
  rmdir "$scratch"
}
trap cleanup EXIT
ssh_options=(-o BatchMode=yes -o ConnectTimeout=8 -o ServerAliveInterval=12)

curl -fsS --max-time 15 "$origin$prefix/latest.json" -o "$scratch/live.json"
live=$("$repo/bin/node" --input-type=module - "$scratch/live.json" "$version" <<'JS'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const [path, candidate] = process.argv.slice(2);
const { version: live } = JSON.parse(readFileSync(path, "utf8"));
for (const version of [candidate, live]) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
}
const a = candidate.split(".").map(BigInt);
const b = live.split(".").map(BigInt);
const component = a.findIndex((value, index) => value !== b[index]);
if (component !== -1 && a[component] < b[component]) {
  throw new Error(`Refusing to roll back ${live} to ${candidate}`);
}
console.log(live);
JS
)

if [[ "$preflight" == 1 ]]; then
  if [[ "$version" == "$live" ]]; then
    printf 'Spheres %s is already live. Bump the version before building a new release.\n' "$live" >&2
    exit 1
  fi
  printf 'Preparing Spheres %s for publication after %s.\n' "$version" "$live"
  exit
fi

if [[ "$version" == "$live" ]]; then
  cmp "$release/latest.json" "$scratch/live.json"
  ssh "${ssh_options[@]}" "$server" "cd '$web/updates/v$version' && sha256sum ${assets[*]}" > "$scratch/live-assets"
  head -n 3 "$release/SHA256SUMS" | cmp - "$scratch/live-assets"
else
  digest=$(shasum -a 256 "$release/SHA256SUMS" | cut -d' ' -f1)
  stage="$staging/updater-$version-$digest"
  ssh "${ssh_options[@]}" "$server" "install -d -m 700 -- '$stage'"
  cd "$release"
  for attempt in 1 2 3; do
    if rsync -c --inplace --partial --timeout=30 -e 'ssh -o BatchMode=yes -o ConnectTimeout=8 -o ServerAliveInterval=12' \
      --rsync-path="flock -x $stage/upload.lock rsync" \
      "${assets[@]}" latest.json SHA256SUMS "$server:$stage/"; then
      break
    fi
    if [[ "$attempt" == 3 ]]; then
      printf 'Upload incomplete. Rerun with the same release directory to resume.\n' >&2
      exit 1
    fi
    printf 'Resuming staged upload after attempt %s.\n' "$attempt" >&2
  done
  ssh "${ssh_options[@]}" "$server" "bash -s -- '$stage' '$web' '$live'" < "$repo/scripts/promote-spheres-mac.sh"
fi

curl -fsS --max-time 15 "$origin$prefix/latest.json" -o "$scratch/served.json"
cmp "$release/latest.json" "$scratch/served.json"
for path in / /invite/release-page-check; do
  curl -fsS --max-time 15 "$origin$path" -o "$scratch/page.html"
  grep -Fq "href=\"$prefix/v$version/${assets[0]}\" download" "$scratch/page.html"
done
printf 'Verified public Spheres %s feed and download links.\n' "$version"
