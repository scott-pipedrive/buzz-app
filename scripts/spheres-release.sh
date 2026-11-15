#!/bin/bash
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
command=${1:-}

case "$command" in
  build|verify|publish|ship)
    [[ $# == 2 ]]
    output=$2
    case "$command" in
      build) exec bash "$repo/scripts/release-spheres-mac.sh" "$output" ;;
      verify) exec bash "$repo/scripts/verify-spheres-mac.sh" "$output" ;;
      publish) exec bash "$repo/scripts/publish-spheres-mac.sh" "$output" ;;
      ship)
        version=$(/usr/bin/plutil -extract version raw -o - "$repo/src-tauri/tauri.spheres.conf.json")
        bash "$repo/scripts/publish-spheres-mac.sh" --preflight "$version"
        bash "$repo/scripts/release-spheres-mac.sh" "$output"
        exec bash "$repo/scripts/publish-spheres-mac.sh" "$output"
        ;;
    esac
    ;;
  upstream)
    [[ $# -le 2 ]]
    cd "$repo"
    requested=${2:-}
    api=https://api.github.com/repos/block/buzz-app/releases
    release=latest
    if [[ -n "$requested" ]]; then
      if [[ ! "$requested" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
        printf 'Choose an exact stable Buzz tag such as v1.0.2.\n' >&2
        exit 2
      fi
      if ! git symbolic-ref --quiet HEAD >/dev/null || [[ -n $(git status --porcelain) ]]; then
        printf 'Switch to a Spheres branch and save local changes before merging Buzz.\n' >&2
        exit 1
      fi
      release="tags/$requested"
    fi
    tag=$(curl -fsS --max-time 20 "$api/$release" | bin/node -e '
      const release = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
      if (release.draft || release.prerelease || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.tag_name)) {
        throw new Error("Expected a published stable Buzz release");
      }
      console.log(release.tag_name);
    ')
    if [[ -z "$requested" ]]; then
      printf 'Latest stable Buzz release: %s\n' "$tag"
      if git merge-base --is-ancestor "refs/tags/$tag^{commit}" HEAD 2>/dev/null; then
        printf 'This checkout already contains %s.\n' "$tag"
      else
        printf 'To bring it in: bash scripts/spheres-release.sh upstream %s\n' "$tag"
      fi
    else
      [[ "$tag" == "$requested" ]]
      ref="refs/tags/$tag"
      git fetch --no-tags https://github.com/block/buzz-app.git "$ref:$ref"
      git merge --no-edit "$ref^{commit}"
    fi
    ;;
  *)
    printf 'Usage: bash %s upstream [BUZZ_TAG] | build|verify|publish|ship RELEASE_DIRECTORY\n' "$0" >&2
    exit 2
    ;;
esac
