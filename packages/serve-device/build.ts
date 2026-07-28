#!/usr/bin/env bun
/**
 * Bundle device-see / serve-device CLI for Node (`npx device-see`).
 * Inlines workspace `serve-runtime` + commander; keeps `ws` external.
 */
import { resolve } from "path";
import { mkdirSync, rmSync, chmodSync, readFileSync, writeFileSync } from "fs";

const root = import.meta.dir;
const distDir = resolve(root, "dist");
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve(root, "src/index.ts")],
  target: "node",
  format: "esm",
  minify: true,
  outdir: distDir,
  naming: "device-see.js",
  external: [
    "fs",
    "path",
    "os",
    "child_process",
    "url",
    "net",
    "tls",
    "crypto",
    "stream",
    "events",
    "http",
    "https",
    "zlib",
    "buffer",
    "module",
    "ws",
  ],
});

if (!result.success) {
  console.error("device-see bin build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const outPath = resolve(distDir, "device-see.js");
const body = readFileSync(outPath, "utf-8");
writeFileSync(outPath, `#!/usr/bin/env node\n${body}`);
chmodSync(outPath, 0o755);
console.log(`dist/device-see.js  ${(body.length / 1024).toFixed(1)} KB`);
