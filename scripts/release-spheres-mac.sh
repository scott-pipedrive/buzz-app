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
if [[ -n "${SPHERES_NOTARY_PROFILE:-}" && -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  printf 'Set APPLE_SIGNING_IDENTITY to a Developer ID Application identity when using SPHERES_NOTARY_PROFILE.\n' >&2
  exit 1
fi
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
  if [[ -n "${SPHERES_NOTARY_PROFILE:-}" ]] && ! /usr/bin/xcrun stapler validate "$app" >/dev/null 2>&1; then
    # Tauri copies these Mach-O helpers as resources without signing them.
    for helper in "$app"/Contents/Resources/bin/*; do
      [[ -f "$helper" && $(/usr/bin/file -b "$helper") == Mach-O* ]] || continue
      /usr/bin/codesign --force --sign "$APPLE_SIGNING_IDENTITY" --options runtime --timestamp "$helper"
    done
    /usr/bin/codesign --force --sign "$APPLE_SIGNING_IDENTITY" --options runtime --timestamp \
      --entitlements "$repo/src-tauri/entitlements.plist" "$app"
    /usr/bin/codesign --verify --deep --strict "$app"
    submission="$output/notary-upload.zip"
    /usr/bin/ditto -c -k --keepParent "$app" "$submission"
    /usr/bin/xcrun notarytool submit "$submission" --keychain-profile "$SPHERES_NOTARY_PROFILE" \
      --output-format json > "$output/notary-submission.json"
    submission_id=$(/usr/bin/plutil -extract id raw -o - "$output/notary-submission.json")
    printf 'Submitted Spheres %s to Apple as %s\n' "$version" "$submission_id"
    /usr/bin/xcrun notarytool wait "$submission_id" --keychain-profile "$SPHERES_NOTARY_PROFILE" \
      --output-format json > "$output/notary-result.json"
    if [[ $(/usr/bin/plutil -extract status raw -o - "$output/notary-result.json") != Accepted ]]; then
      printf 'Apple did not accept the notarisation submission. See %s/notary-result.json.\n' "$output" >&2
      exit 1
    fi
    /usr/bin/xcrun stapler staple "$app"
  fi
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
