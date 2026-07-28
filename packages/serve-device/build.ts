#!/usr/bin/env bun
/**
 * Bundle serve-device CLI for Node (`npx serve-device`).
 * Inlines workspace `serve-runtime`; keeps `ws` external like serve-sim.
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
  naming: "serve-device.js",
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
  console.error("serve-device bin build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const outPath = resolve(distDir, "serve-device.js");
const body = readFileSync(outPath, "utf-8");
writeFileSync(outPath, `#!/usr/bin/env node\n${body}`);
chmodSync(outPath, 0o755);
console.log(`dist/serve-device.js  ${(body.length / 1024).toFixed(1)} KB`);
