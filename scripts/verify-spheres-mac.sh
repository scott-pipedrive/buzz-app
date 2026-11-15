#!/bin/bash
set -euo pipefail

if [[ $# != 1 ]]; then
  printf 'Usage: bash %s RELEASE_DIRECTORY\n' "$0" >&2
  exit 2
fi
release=$(cd "$1" && pwd -P)
repo=$(cd "$(dirname "$0")/.." && pwd -P)
archive=Spheres-Mac-arm64.app.tar.gz

(cd "$release" && shasum -a 256 Spheres-Mac-arm64.zip "$archive" "$archive.sig" latest.json | cmp - SHA256SUMS)

"$repo/bin/node" --input-type=module - "$release" "$repo/src-tauri/tauri.spheres-updater.conf.json" "$archive" <<'JS'
import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";

const [directory, configPath, archive] = process.argv.slice(2);
const contents = (name) => readFileSync(join(directory, name), "utf8").trim();
const { version, platforms } = JSON.parse(contents("latest.json"));
const { pubkey, endpoints, requireSignedVersion } = JSON.parse(readFileSync(configPath, "utf8")).plugins.updater;
const signature = contents(`${archive}.sig`);
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
assert.equal(requireSignedVersion, true);
assert.deepEqual(platforms, {
  "darwin-aarch64": { url: new URL(`v${version}/${archive}`, endpoints[0]).href, signature },
});

const decode = (text) => Buffer.from(text, "base64");
const [, publicRecord] = decode(pubkey).toString("utf8").trimEnd().split("\n");
const key = decode(publicRecord);
const publicKey = createPublicKey({
  key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), key.subarray(10)]),
  type: "spki",
  format: "der",
});
const [untrusted, recordText, trustedLine, global] = decode(signature).toString("utf8").trimEnd().split("\n");
const record = decode(recordText);
const trustedPrefix = "trusted comment: ";
assert.ok(untrusted.startsWith("untrusted comment: ") && trustedLine.startsWith(trustedPrefix));
assert.equal(key.length, 42);
assert.equal(record.length, 74);
assert.equal(record.subarray(0, 2).toString(), "ED", "Expected a prehashed Minisign signature");
assert.deepEqual(record.subarray(2, 10), key.subarray(2, 10), "Updater key mismatch");
const trusted = trustedLine.slice(trustedPrefix.length);
assert.deepEqual(trusted.split("\t").filter((part) => part.startsWith("version:")), [`version:${version}`]);

const hash = createHash("blake2b512");
for await (const chunk of createReadStream(join(directory, archive))) hash.update(chunk);
const signedHash = record.subarray(10);
assert.ok(verify(null, hash.digest(), publicKey, signedHash), "Updater archive signature invalid");
assert.ok(verify(null, Buffer.concat([signedHash, Buffer.from(trusted)]), publicKey, decode(global)), "Updater trusted comment signature invalid");
console.log(version);
JS
