# serve-device Plan 2: Package Scaffold & CLI Mirror

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Index:** [overview](./2026-07-28-serve-device-overview.md)  
> **Requires:** Plan 1 complete.

**Goal:** Ship a real npm package `serve-device` with bin `serve-device`, isolated state/ports, and a mirrored CLI surface that runs against a stub `DeviceBackend` (clear errors for not-yet-implemented protocol/WDA).

**Architecture:** New `packages/serve-device` bundles its own CLI entry (Commander), binds `SERVE_DEVICE_PRODUCT`, and injects a `StubIosDeviceBackend` until Plan 3/4 replace it. Preview server reuse is **out of scope** here — `--detach`/`serve` may print “stream not implemented until Plan 3” rather than embedding the full sim UI. Focus on package identity, `--list`/`--kill`/state, and subcommands that call the backend.

**Tech Stack:** Commander (same major as serve-sim), Bun build script patterned on `packages/serve-sim/build.ts` (bin only; no middleware export), `serve-runtime`.

## Global Constraints

- Same as overview + Plan 1.
- Default ports: preview `4200`, helper `4100`.
- State: `$TMPDIR/serve-device` only — never write under `serve-sim`.
- Do not implement `devicectl` or WDA here (stub throws).
- Do not add Expo middleware.
- Node `>=20`.

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/serve-device/package.json` | Public package `serve-device`, bin, files, engines |
| `packages/serve-device/build.ts` | Bundle `dist/serve-device.js` for Node |
| `packages/serve-device/src/index.ts` | Commander CLI entry |
| `packages/serve-device/src/product.ts` | Re-export `SERVE_DEVICE_PRODUCT` |
| `packages/serve-device/src/state.ts` | Bind runtime state to device product |
| `packages/serve-device/src/backends/stub-ios-device-backend.ts` | Stub implementing `DeviceBackend` |
| `packages/serve-device/src/cli/list-kill.ts` | `--list` / `--kill` using device state dir |
| `packages/serve-device/src/__tests__/cli-isolation.test.ts` | State/port isolation vs sim constants |
| `packages/serve-device/src/__tests__/stub-backend.test.ts` | Stub error messages |
| `packages/serve-device/README.md` | v1 scope: USB, macOS, WDA coming, no Wi‑Fi yet |
| Root `package.json` | workspaces already `packages/*` — verify `dev` script optional |

---

### Task 1: Scaffold `packages/serve-device`

**Files:**
- Create: `packages/serve-device/package.json`
- Create: `packages/serve-device/src/index.ts`
- Create: `packages/serve-device/src/product.ts`
- Create: `packages/serve-device/src/state.ts`
- Create: `packages/serve-device/README.md`

**Interfaces:**
- Consumes: `SERVE_DEVICE_PRODUCT`, state helpers from `serve-runtime`
- Produces: package name `serve-device`, bin `serve-device` → `dist/serve-device.js`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "serve-device",
  "version": "0.0.1",
  "type": "module",
  "license": "Apache-2.0",
  "bin": {
    "serve-device": "dist/serve-device.js"
  },
  "files": [
    "dist/serve-device.js",
    "README.md"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "bun run build.ts",
    "test": "bun test src"
  },
  "dependencies": {
    "commander": "^14.0.1",
    "serve-runtime": "workspace:*",
    "ws": "^8.21.0"
  },
  "devDependencies": {
    "@types/ws": "^8.18.1",
    "typescript": "^5.7.0"
  }
}
```

Note: before publishing to npm, `serve-runtime` must be **bundled into** `dist/serve-device.js` (same pattern as serve-sim bundling workspace code) so consumers do not need a published `serve-runtime`. The build step must inline it.

- [ ] **Step 2: product.ts + state.ts**

```ts
// src/product.ts
export { SERVE_DEVICE_PRODUCT as PRODUCT } from "serve-runtime";
```

```ts
// src/state.ts
import {
  SERVE_DEVICE_PRODUCT,
  inProcessDeviceServerState,
  listStateFiles as listStateFilesFor,
  stateDirFor,
  stateFileForDevice as stateFileForDeviceFor,
  writeDeviceServerState,
  type DeviceServerState,
} from "serve-runtime";

export const STATE_DIR = stateDirFor(SERVE_DEVICE_PRODUCT);
export type ServeDeviceState = DeviceServerState;

export function stateFileForDevice(udid: string): string {
  return stateFileForDeviceFor(SERVE_DEVICE_PRODUCT, udid);
}
export function listStateFiles(): string[] {
  return listStateFilesFor(SERVE_DEVICE_PRODUCT);
}
export function writeServeDeviceState(state: ServeDeviceState): void {
  writeDeviceServerState(SERVE_DEVICE_PRODUCT, state);
}
export function inProcessServeDeviceState(
  udid: string,
  port: number,
  base = "/",
  host = "127.0.0.1",
): ServeDeviceState {
  return inProcessDeviceServerState(
    SERVE_DEVICE_PRODUCT,
    udid,
    port,
    base,
    host,
  );
}
```

- [ ] **Step 3: Minimal CLI that prints version and help**

```ts
// src/index.ts
import { Command } from "commander";
import { PRODUCT } from "./product";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function resolveVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
        "utf8",
      ),
    );
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();
program
  .name(PRODUCT.binName)
  .description("Stream and control a physical iOS device from the browser / CLI")
  .version(resolveVersion(), "-v, --version")
  .option(
    "-p, --port <port>",
    `Starting port (preview default: ${PRODUCT.defaultPreviewPort})`,
    (v) => parseInt(v, 10),
  );

program.action(() => {
  console.error(
    `${PRODUCT.binName}: device streaming lands in a later release. Try \`${PRODUCT.binName} doctor\` or \`${PRODUCT.binName} --help\`.`,
  );
  process.exitCode = 1;
});

program.parse();
```

- [ ] **Step 4: README stating v1 constraints**

Must include: macOS only; USB only for now; Wi‑Fi planned; WDA required for touch; no Expo middleware yet; does not share state with `serve-sim`.

- [ ] **Step 5: `bun install` + commit**

```bash
bun install
git add packages/serve-device
git commit -m "$(cat <<'EOF'
feat: scaffold serve-device package with isolated product identity

EOF
)"
```

---

### Task 2: Stub backend (TDD)

**Files:**
- Create: `packages/serve-device/src/backends/stub-ios-device-backend.ts`
- Create: `packages/serve-device/src/__tests__/stub-backend.test.ts`

**Interfaces:**
- Produces: `createStubIosDeviceBackend(): DeviceBackend`
- `kind: "device"`
- `capabilities()`: all feature flags `true` except document `touchRequiresAgent: true`
- `listDevices()` → `[]`
- `resolveDevice` → throw `Could not resolve device`
- Every mutating method throws:

```ts
new Error(
  "serve-device: iOS USB backend not implemented yet (Plan 3). Touch/WDA lands in Plan 4.",
)
```

- [ ] **Step 1: Write tests asserting message + capabilities.touchRequiresAgent === true**

- [ ] **Step 2: Implement stub**

- [ ] **Step 3: `bun test` PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): add stub DeviceBackend with explicit Plan 3/4 errors

EOF
)"
```

---

### Task 3: `--list` / `--kill` isolation (TDD)

**Files:**
- Create: `packages/serve-device/src/cli/list-kill.ts`
- Create: `packages/serve-device/src/__tests__/cli-isolation.test.ts`
- Modify: `packages/serve-device/src/index.ts`

**Interfaces:**
- `listStreams(): ServeDeviceState[]` reads only `SERVE_DEVICE_PRODUCT` state files
- `killStreams(): void` kills pids from those files and deletes them
- Mirror JSON shape used by `serve-sim --list` (pid, port, device, url, streamUrl, wsUrl)

- [ ] **Step 1: Test that writing a fake state under serve-device list returns it, and serve-sim’s STATE_DIR file with same UDID is ignored**

Use real tmp dirs via product helpers; clean up in `afterEach`.

- [ ] **Step 2: Implement list/kill**

Reuse patterns from `packages/serve-sim/src/index.ts` (`listStreams`, `killStreams`, `isProcessAlive`) but import device `state.ts`.

- [ ] **Step 3: Wire CLI flags**

```ts
.option("--list", "List running serve-device servers as JSON")
.option("--kill", "Stop serve-device servers recorded in its state dir")
.option("-q, --quiet", "Quiet mode")
```

When `--list` / `--kill` present, run those paths and exit (same order of precedence as serve-sim).

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): add --list/--kill against isolated state directory

EOF
)"
```

---

### Task 4: Mirrored subcommands calling backend

**Files:**
- Modify: `packages/serve-device/src/index.ts`
- Create: `packages/serve-device/src/cli/backend-commands.ts`
- Create: `packages/serve-device/src/__tests__/backend-commands.test.ts`

**Interfaces:**
- Subcommands (names mirror serve-sim): `tap`, `gesture`, `button`, `screenshot`, `install`, `launch`, `doctor` (doctor stub OK)
- Each resolves `-d, --device <udid|name>` then calls stub backend
- Exit non-zero on stub errors; print stderr message

Exact CLI shapes:

```text
serve-device tap <x> <y> [-d <udid|name>]
serve-device gesture '<json>' [-d <udid|name>]
serve-device button [home|lock|side-button|siri|apple-pay] [-d <udid|name>]
serve-device screenshot [-d <udid|name>] [-o <path>]
serve-device install <path-to-app> [-d <udid|name>]
serve-device launch <bundle-id> [-d <udid|name>]
serve-device doctor
```

`doctor` in Plan 2 only checks: Darwin, `xcrun` present, Node >=20; prints “USB backend: not ready”, “WDA: not ready”.

- [ ] **Step 1: Unit-test `parseGestureJson` and device flag plumbing with a injectable backend mock** (not the stub) that records calls

- [ ] **Step 2: Implement commands**

- [ ] **Step 3: Manual smoke**

```bash
cd packages/serve-device && bun src/index.ts tap 0.5 0.5
```

Expected: non-zero exit; stderr mentions Plan 3/4.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): mirror tap/gesture/button/screenshot/install/launch CLI

EOF
)"
```

---

### Task 5: Build bin bundle

**Files:**
- Create: `packages/serve-device/build.ts`
- Modify: `packages/serve-device/package.json` if needed

- [ ] **Step 1: build.ts** — Bun.build entry `src/index.ts`, target `node`, outfile `dist/serve-device.js`, minify, banner `#!/usr/bin/env node`. Bundle workspace `serve-runtime` (do not leave external).

Pattern after `packages/serve-sim/build.ts` bin section (skip client HTML / middleware / native).

- [ ] **Step 2: Run build**

```bash
cd packages/serve-device && bun run build.ts
node dist/serve-device.js --help
```

Expected: help text with name `serve-device`.

- [ ] **Step 3: Commit dist if this repo commits dist for serve-sim; otherwise follow serve-sim’s convention**

Check whether `packages/serve-sim/dist` is gitignored. Match that policy.

```bash
git add packages/serve-device/build.ts packages/serve-device/package.json
# add dist only if serve-sim commits dist
git commit -m "$(cat <<'EOF'
build(serve-device): add Node-targeted bin bundle

EOF
)"
```

---

### Task 6: Isolation acceptance

- [ ] **Step 1: Assert constants**

```bash
bun -e 'import { PRODUCT } from "./packages/serve-device/src/product.ts";
import { STATE_DIR } from "./packages/serve-device/src/state.ts";
import { STATE_DIR as SIM } from "./packages/serve-sim/src/state.ts";
if (STATE_DIR === SIM) throw new Error("state dirs collided");
if (PRODUCT.defaultPreviewPort === 3200) throw new Error("port collided");
console.log("isolation OK", STATE_DIR, PRODUCT.defaultPreviewPort);'
```

- [ ] **Step 2: Run package tests**

```bash
cd packages/serve-device && bun test src
```

---

## Plan 2 self-review

| Spec item | Task |
|---|---|
| `npx serve-device` package/bin | Task 1 + 5 |
| Isolated ports/state/`--kill` | Task 1–3, 6 |
| Mirror CLI verbs | Task 4 |
| No middleware / no WDA yet | stub + doctor messages |
| macOS messaging in README | Task 1 |

**Stop here.** Next: [Plan 3](./2026-07-28-serve-device-3-ios-usb-backend.md).
