#!/bin/bash
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
work=$(dirname "$repo")
applications="$HOME/Applications"
installed="$applications/Spheres.app"
source_bundle="$repo/target/debug/bundle/macos/Spheres.app"
signing="$HOME/Library/Application Support/Spheres Preview Signing"
keychain="$signing/Spheres Preview.keychain-db"
certificate="$signing/Spheres Preview Signing.pem"
bundle_id=com.askbellboy.buzz.preview
exports="$HOME/Documents/ChatGPT/spheres"

plist() {
  /usr/libexec/PlistBuddy -c "Print :$2" "$1/Contents/Info.plist"
}

is_spheres_bundle() {
  [[ -d "$1" && ! -L "$1" ]] &&
    [[ $(plist "$1" CFBundleIdentifier 2>/dev/null) == "$bundle_id" ]]
}

is_running() {
  /bin/ps -axo comm= | /usr/bin/grep -Fx -- "$1/Contents/MacOS/Buzz" >/dev/null
}

trash_build() {
  [[ -e "$1" && ! -L "$1" ]] || return 0
  if [[ "$1" == *.app ]]; then
    is_spheres_bundle "$1" || return 0
    if is_running "$1"; then
      printf 'Still open, kept %s\n' "$1" >&2
      return 0
    fi
  fi
  /usr/bin/trash -v "$1"
}

cleanup_builds() {
  local current_version app archive archive_version stage
  current_version=$(plist "$installed" CFBundleShortVersionString)
  shopt -s nullglob
  for app in \
    "$applications"/.spheres-*/*.app \
    "$applications/Bellboy Buzz Preview.app" \
    "$work"/spheres/{dmg-stage,previous-build,verify-download}.*/*.app \
    "$work/spheres/Spheres before Braid.app" \
    "$work"/Bellboy\ Buzz\ Preview\ pre-*.app \
    "$repo/target/debug/bundle/macos/Bellboy Buzz Preview.app"; do
    trash_build "$app"
  done
  for archive in "$exports"/Spheres\ *\ Mac\ Preview.zip \
    "$exports"/Spheres\ *\ Backup.zip \
    "$work"/spheres/Spheres-Mac-Preview-*.zip \
    "$HOME"/Downloads/Spheres-Mac-Preview*.zip; do
    [[ -f "$archive" && ! -L "$archive" ]] || continue
    archive_version=$(
      /usr/bin/unzip -p "$archive" Spheres.app/Contents/Info.plist 2>/dev/null |
        /usr/bin/plutil -extract CFBundleShortVersionString raw -o - - 2>/dev/null
    ) || continue
    [[ "$archive_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    if [[ "$archive_version" != "$current_version" &&
      $(printf '%s\n%s\n' "$archive_version" "$current_version" | /usr/bin/sort -V | head -1) == "$archive_version" ]]; then
      trash_build "$archive"
    fi
  done
  for stage in "$applications"/.spheres-* "$applications"/.install-spheres.* \
    "$work"/spheres/{dmg-stage,previous-build,verify-download}.*; do
    [[ -d "$stage" && ! -L "$stage" ]] || continue
    rmdir "$stage" 2>/dev/null || true
  done
}

if [[ "${1:-}" == "--cleanup" && "$#" == 1 ]]; then
  is_spheres_bundle "$installed"
  /usr/bin/codesign --verify --strict "$installed"
  cleanup_builds
  exit
fi
if [[ -n "${1:-}" ]]; then
  printf 'Usage: %s [--cleanup]\n' "$0" >&2
  exit 2
fi
if ! is_spheres_bundle "$source_bundle"; then
  printf 'Build Spheres with pnpm build:spheres before installing.\n' >&2
  exit 1
fi
if [[ ! -f "$keychain" || ! -f "$certificate" || ! -f "$signing/keychain-password" ]]; then
  printf 'The local Spheres Preview Signing identity is missing.\n' >&2
  exit 1
fi
if [[ -e "$installed" ]] && ! is_spheres_bundle "$installed"; then
  printf 'The Applications path contains a different app.\n' >&2
  exit 1
fi
if is_running "$installed"; then
  printf 'Quit Spheres before replacing the installed app.\n' >&2
  exit 1
fi

if [[ -e "$installed" ]]; then
  installed_version=$(plist "$installed" CFBundleShortVersionString)
  source_version=$(plist "$source_bundle" CFBundleShortVersionString)
  if [[ "$source_version" != "$installed_version" &&
    $(printf '%s\n%s\n' "$source_version" "$installed_version" | /usr/bin/sort -V | head -1) == "$source_version" ]]; then
    printf 'The source build is older than the installed app.\n' >&2
    exit 1
  fi
fi

mkdir -p "$applications"
staging=$(mktemp -d "$applications/.install-spheres.XXXXXX")
staged="$staging/Spheres.app"
previous="$staging/Previous Spheres.app"
finish() {
  local status=$?
  if [[ -e "$previous" && ! -e "$installed" ]]; then
    mv "$previous" "$installed"
  fi
  if [[ -e "$staged" ]]; then
    trash_build "$staged" || true
  fi
  rmdir "$staging" 2>/dev/null || true
  return "$status"
}
trap finish EXIT

fingerprint=$(/usr/bin/openssl x509 -in "$certificate" -noout -fingerprint -sha1 |
  cut -d= -f2 | tr -d :)
[[ "$fingerprint" =~ ^[0-9A-F]{40}$ ]]
requirement="identifier \"$bundle_id\" and certificate leaf = H\"$fingerprint\""
# Use the dedicated signing keychain without changing the user's login keychain.
printf 'unlock-keychain -p %s "%s"\n' "$(<"$signing/keychain-password")" "$keychain" |
  /usr/bin/security -i >/dev/null
/usr/bin/ditto "$source_bundle" "$staged"
/usr/bin/codesign --force --sign "$fingerprint" --keychain "$keychain" \
  --timestamp=none --entitlements "$repo/src-tauri/entitlements.plist" \
  -r "=designated => $requirement" "$staged"
/usr/bin/codesign --verify --deep --strict -R "=$requirement" "$staged"

if [[ -e "$installed" ]]; then
  mv "$installed" "$previous"
fi
mv "$staged" "$installed"
if ! /usr/bin/codesign --verify --deep --strict -R "=$requirement" "$installed"; then
  mv "$installed" "$staged"
  exit 1
fi
trash_build "$source_bundle"
trash_build "$previous"
cleanup_builds
printf 'Installed Spheres %s at %s\n' "$(plist "$installed" CFBundleShortVersionString)" "$installed"
