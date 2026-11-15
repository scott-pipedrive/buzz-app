# Spheres Mac releases

Use an Apple Silicon Mac and keep the same Spheres checkout between releases. Its
`target/` directory lets Cargo reuse prior builds. Set up a fresh checkout with
the repository’s normal dependency bootstrap.

Check the latest public stable Buzz version before deciding whether to bring it
into Spheres:

```sh
bash scripts/spheres-release.sh upstream
bash scripts/spheres-release.sh upstream v1.0.2  # use the stable tag you chose
```

The second command fetches and merges that exact tag onto the current clean
Spheres branch. Resolve any merge conflicts and review the Spheres branding,
community settings, and native integrations before shipping a Buzz upgrade.

Bump `version` in `src-tauri/tauri.spheres.conf.json` after the desktop changes are
ready. Spheres uses its own version numbers.

Set the deployment values in your local shell before running `ship` or `publish`.
Use the host with the existing Caddy routes, the directory serving the Spheres
pages, and the staging directory that holds `publish.lock`. SSH uses your
existing SSH configuration and agent.

```sh
export SPHERES_RELEASE_SSH_HOST=publisher@server.example.org
export SPHERES_RELEASE_WEB_ROOT=/srv/example-spheres
export SPHERES_RELEASE_STAGING_ROOT=/var/backups/example-spheres
```

`ship` checks the live version before building, then packages and publishes in
one command.

```sh
bash scripts/spheres-release.sh ship /absolute/path/to/releases/spheres-1.0.10
```

To review the package first or resume a failed upload, use the same release
directory for the separate steps:

```sh
bash scripts/spheres-release.sh build /absolute/path/to/releases/spheres-1.0.10
bash scripts/spheres-release.sh verify /absolute/path/to/releases/spheres-1.0.10
bash scripts/spheres-release.sh publish /absolute/path/to/releases/spheres-1.0.10
```

`build` requires a new output directory. It uses the existing Mac signing
identity and Spheres updater key, and produces the website ZIP, signed update
archive, manifest, and SHA-256 checksums. `verify` checks the recorded bytes and
the archive’s version-bound signature. Keep those exact files for upload retries.

`publish` uses the existing SSH access and Caddy routes. It stages uploads by
their checksums, then updates the home and invite download links and the live
update feed. Older release URLs remain available. Updater-enabled Spheres builds
offer the new version at their next update check. The public 1.0.8 build needs a
one-time manual upgrade.

The scripts package and publish the public app. They leave the installed Mac
app, user profile, and local Keychain helper alone.
