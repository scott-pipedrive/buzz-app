import { copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const source = fileURLToPath(
  new URL("../examples/plugins/spheres-home/", import.meta.url),
);
const output = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../dist-plugins/spheres-home/", import.meta.url));

await build({
  configFile: false,
  publicDir: false,
  envDir: false,
  build: {
    outDir: output,
    emptyOutDir: false,
    lib: {
      entry: join(source, "main.js"),
      formats: ["es"],
      fileName: () => "plugin.js",
    },
  },
});
await copyFile(join(source, "manifest.json"), join(output, "manifest.json"));
console.log(`Spheres Home plugin: ${output}`);
