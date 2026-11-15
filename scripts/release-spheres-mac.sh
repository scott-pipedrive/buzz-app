#!/bin/bash
set -euo pipefail

if [[ $# != 1 || $(uname -sm) != 'Darwin arm64' ]]; then
  printf 'Usage on an Apple Silicon Mac: pnpm release:spheres NEW_OUTPUT_DIRECTORY\n' >&2
  exit 2
fi

output=$1
repo=$(cd "$(dirname "$0")/.." && pwd -P)
config="$repo/src-tauri/tauri.spheres-updater.conf.json"
product="$repo/src-tauri/tauri.spheres.conf.json"
key=${TAURI_SIGNING_PRIVATE_KEY_PATH:-"$HOME/Library/Application Support/Spheres Updater Signing/spheres.key"}
version=$(/usr/bin/plutil -extract version raw -o - "$product")
public_key=$(/usr/bin/plutil -extract plugins.updater.pubkey raw -o - "$config")
endpoint=$(/usr/bin/plutil -extract plugins.updater.endpoints.0 raw -o - "$config")
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ || ! -s "$key" || ! -s "$key.pub" || $(<"$key.pub") != "$public_key" ]]; then
  printf 'Expected a release version and the matching Spheres updater keypair.\n' >&2
  exit 1
fi
mkdir "$output"
output=$(cd "$output" && pwd -P)

cd "$repo"
env -u TAURI_SIGNING_PRIVATE_KEY -u TAURI_SIGNING_PRIVATE_KEY_PATH -u TAURI_SIGNING_PRIVATE_KEY_PASSWORD \
  BUZZ_UPDATER_PUBLIC_KEY="$public_key" BUZZ_UPDATER_ENDPOINT="$endpoint" \
  bin/pnpm build:spheres --config "$config"

app="$repo/target/debug/bundle/macos/Spheres.app"
bundle_id=$(/usr/bin/plutil -extract identifier raw -o - "$product")
[[ $(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$app/Contents/Info.plist") == "$bundle_id" ]]
[[ $(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$app/Contents/Info.plist") == "$version" ]]
/usr/bin/grep -aqF "$endpoint" "$app/Contents/MacOS/Buzz"
/usr/bin/grep -aqF "$public_key" "$app/Contents/MacOS/Buzz"
if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  signing="$HOME/Library/Application Support/Spheres Preview Signing"
  keychain="$signing/Spheres Preview.keychain-db"
  certificate="$signing/Spheres Preview Signing.pem"
  fingerprint=$(/usr/bin/openssl x509 -in "$certificate" -noout -fingerprint -sha1 | cut -d= -f2 | tr -d :)
  [[ "$fingerprint" =~ ^[0-9A-F]{40}$ ]]
  requirement="identifier \"$bundle_id\" and certificate leaf = H\"$fingerprint\""
  printf 'unlock-keychain -p %s "%s"\n' "$(<"$signing/keychain-password")" "$keychain" |
    /usr/bin/security -i >/dev/null
  /usr/bin/codesign --force --sign "$fingerprint" --keychain "$keychain" --timestamp=none \
    --entitlements "$repo/src-tauri/entitlements.plist" -r "=designated => $requirement" "$app"
  /usr/bin/codesign --verify --strict -R "=$requirement" "$app"
else
  /usr/bin/xcrun stapler validate "$app"
fi
/usr/bin/codesign --verify --deep --strict "$app"

archive="$output/Spheres-Mac-arm64.app.tar.gz"
COPYFILE_DISABLE=1 /usr/bin/tar -czf "$archive" -C "$(dirname "$app")" Spheres.app
env -u TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PATH="$key" \
  ./node_modules/.bin/tauri signer sign --app-version "$version" "$archive"
/usr/bin/ditto -c -k --keepParent "$app" "$output/Spheres-Mac-arm64.zip"

export SPHERES_RELEASE_VERSION="$version" SPHERES_RELEASE_ENDPOINT="$endpoint" SPHERES_RELEASE_ARCHIVE="$archive"
bin/node --input-type=module <<'JS' > "$output/latest.json"
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const { SPHERES_RELEASE_VERSION: version, SPHERES_RELEASE_ENDPOINT: endpoint, SPHERES_RELEASE_ARCHIVE: archive } = process.env;
const url = new URL(`v${version}/${basename(archive)}`, endpoint).href;
const signature = readFileSync(`${archive}.sig`, "utf8").trim();
if (!signature) throw new Error("The updater archive has no signature");
console.log(JSON.stringify({ version, platforms: { "darwin-aarch64": { url, signature } } }, null, 2));
JS
(cd "$output" && shasum -a 256 Spheres-Mac-arm64.zip Spheres-Mac-arm64.app.tar.gz Spheres-Mac-arm64.app.tar.gz.sig latest.json > SHA256SUMS)
bash "$repo/scripts/verify-spheres-mac.sh" "$output" >/dev/null
printf 'Packaged Spheres %s in %s\n' "$version" "$output"
