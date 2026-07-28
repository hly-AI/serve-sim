# serve-device Plan 1: Backend Contract & Product Identity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Index:** [overview](./2026-07-28-serve-device-overview.md)

**Goal:** Introduce a private workspace package `serve-runtime` that owns `ProductIdentity`, parameterized server state, and the `DeviceBackend` interface — without changing `serve-sim` user-facing behavior.

**Architecture:** `serve-runtime` is an internal library (not published). `serve-sim` depends on it and re-exports state helpers with the existing `serve-sim` identity so current imports and `$TMPDIR/serve-sim` paths keep working. A `SimulatorDeviceBackend` adapter wraps today’s `simctl` resolution so later plans can swap backends without rewriting CLI verbs.

**Tech Stack:** Bun workspaces, TypeScript, `bun:test`, existing `xcrun simctl`.

## Global Constraints

- Node `>=20`; kebab-case TS/JS filenames.
- macOS-only product; do not add Linux code paths.
- Do not publish `serve-runtime` to npm.
- Do not create `serve-device` package in this plan (Plan 2).
- Do not implement WDA, `devicectl`, or Wi‑Fi.
- Preserve `serve-sim` CLI behavior and `$TMPDIR/serve-sim` state paths.
- Prefer TDD; run tests with `bun test` from the touched package.

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/serve-runtime/package.json` | Private workspace package metadata |
| `packages/serve-runtime/src/product-identity.ts` | Bin name, state dir name, default ports |
| `packages/serve-runtime/src/state.ts` | Parameterized state dir / file helpers (moved logic from serve-sim) |
| `packages/serve-runtime/src/device-backend.ts` | `DeviceBackend` + related types |
| `packages/serve-runtime/src/index.ts` | Public exports for workspace consumers |
| `packages/serve-runtime/src/__tests__/product-identity.test.ts` | Identity constants |
| `packages/serve-runtime/src/__tests__/state.test.ts` | Parameterized state isolation |
| `packages/serve-runtime/src/__tests__/device-backend.test.ts` | Contract smoke tests via a fake backend |
| `packages/serve-sim/src/product.ts` | `SERVE_SIM_IDENTITY` constant |
| `packages/serve-sim/src/state.ts` | Thin wrapper re-exporting runtime state bound to sim identity |
| `packages/serve-sim/src/backends/simulator-device-backend.ts` | Adapter implementing `DeviceBackend` with `simctl` |
| `packages/serve-sim/src/__tests__/simulator-device-backend.test.ts` | Adapter unit tests (mockable exec) |
| `packages/serve-sim/package.json` | Add workspace dependency on `serve-runtime` |

---

### Task 1: Scaffold `serve-runtime` package

**Files:**
- Create: `packages/serve-runtime/package.json`
- Create: `packages/serve-runtime/src/index.ts`
- Create: `packages/serve-runtime/tsconfig.json` (only if repo packages already use per-package tsconfig; otherwise skip and rely on root)

**Interfaces:**
- Consumes: nothing
- Produces: workspace package name `serve-runtime`, `private: true`, `exports` pointing at `./src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "serve-runtime",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "bun test src"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create empty barrel**

```ts
// packages/serve-runtime/src/index.ts
export {};
```

- [ ] **Step 3: Install workspace links**

Run from repo root:

```bash
bun install
```

Expected: lockfile updates; `packages/serve-runtime` listed under workspaces without publish errors.

- [ ] **Step 4: Commit**

```bash
git add packages/serve-runtime/package.json packages/serve-runtime/src/index.ts
git commit -m "$(cat <<'EOF'
chore: scaffold private serve-runtime workspace package

EOF
)"
```

---

### Task 2: `ProductIdentity` (TDD)

**Files:**
- Create: `packages/serve-runtime/src/product-identity.ts`
- Create: `packages/serve-runtime/src/__tests__/product-identity.test.ts`
- Modify: `packages/serve-runtime/src/index.ts`

**Interfaces:**
- Produces:

```ts
export type Transport = "usb" | "wifi";

export interface ProductIdentity {
  /** npm bin / CLI name, e.g. "serve-sim" | "serve-device" */
  binName: string;
  /** Directory name under os.tmpdir(), e.g. "serve-sim" */
  stateDirName: string;
  /** Default preview HTTP port when user omits --port */
  defaultPreviewPort: number;
  /** Default helper port for detached helpers (if used) */
  defaultHelperPort: number;
}

export const SERVE_SIM_PRODUCT: ProductIdentity = {
  binName: "serve-sim",
  stateDirName: "serve-sim",
  defaultPreviewPort: 3200,
  defaultHelperPort: 3100,
};

export const SERVE_DEVICE_PRODUCT: ProductIdentity = {
  binName: "serve-device",
  stateDirName: "serve-device",
  defaultPreviewPort: 4200,
  defaultHelperPort: 4100,
};
```

- [ ] **Step 1: Write failing test**

```ts
// packages/serve-runtime/src/__tests__/product-identity.test.ts
import { describe, expect, test } from "bun:test";
import {
  SERVE_DEVICE_PRODUCT,
  SERVE_SIM_PRODUCT,
} from "../product-identity";

describe("product identity", () => {
  test("serve-sim and serve-device do not share state dir or default ports", () => {
    expect(SERVE_SIM_PRODUCT.stateDirName).toBe("serve-sim");
    expect(SERVE_DEVICE_PRODUCT.stateDirName).toBe("serve-device");
    expect(SERVE_SIM_PRODUCT.defaultPreviewPort).not.toBe(
      SERVE_DEVICE_PRODUCT.defaultPreviewPort,
    );
    expect(SERVE_SIM_PRODUCT.defaultHelperPort).not.toBe(
      SERVE_DEVICE_PRODUCT.defaultHelperPort,
    );
    expect(SERVE_DEVICE_PRODUCT.binName).toBe("serve-device");
    expect(SERVE_DEVICE_PRODUCT.defaultPreviewPort).toBe(4200);
    expect(SERVE_DEVICE_PRODUCT.defaultHelperPort).toBe(4100);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/serve-runtime && bun test src/__tests__/product-identity.test.ts
```

Expected: fail resolving `../product-identity`.

- [ ] **Step 3: Implement**

```ts
// packages/serve-runtime/src/product-identity.ts
export type Transport = "usb" | "wifi";

export interface ProductIdentity {
  binName: string;
  stateDirName: string;
  defaultPreviewPort: number;
  defaultHelperPort: number;
}

export const SERVE_SIM_PRODUCT: ProductIdentity = {
  binName: "serve-sim",
  stateDirName: "serve-sim",
  defaultPreviewPort: 3200,
  defaultHelperPort: 3100,
};

export const SERVE_DEVICE_PRODUCT: ProductIdentity = {
  binName: "serve-device",
  stateDirName: "serve-device",
  defaultPreviewPort: 4200,
  defaultHelperPort: 4100,
};
```

Export from `index.ts`:

```ts
export {
  SERVE_DEVICE_PRODUCT,
  SERVE_SIM_PRODUCT,
  type ProductIdentity,
  type Transport,
} from "./product-identity";
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/serve-runtime && bun test src/__tests__/product-identity.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/serve-runtime
git commit -m "$(cat <<'EOF'
feat(serve-runtime): add product identity constants for sim and device

EOF
)"
```

---

### Task 3: Parameterized state helpers (TDD)

**Files:**
- Create: `packages/serve-runtime/src/state.ts`
- Create: `packages/serve-runtime/src/__tests__/state.test.ts`
- Modify: `packages/serve-runtime/src/index.ts`

**Interfaces:**
- Consumes: `ProductIdentity.stateDirName`
- Produces:

```ts
export interface DeviceServerState {
  pid: number;
  port: number;
  device: string;
  url: string;
  streamUrl: string;
  wsUrl: string;
}

export function stateDirFor(product: ProductIdentity): string;
export function stateFileForDevice(product: ProductIdentity, udid: string): string;
export function listStateFiles(product: ProductIdentity): string[];
export function writeDeviceServerState(
  product: ProductIdentity,
  state: DeviceServerState,
): void;
export function inProcessDeviceServerState(
  product: ProductIdentity,
  udid: string,
  port: number,
  base?: string,
  host?: string,
): DeviceServerState;
```

Behavior must match current `packages/serve-sim/src/state.ts`, except the directory comes from `product.stateDirName` instead of a hard-coded `"serve-sim"`.

- [ ] **Step 1: Write failing tests**

```ts
// packages/serve-runtime/src/__tests__/state.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  SERVE_DEVICE_PRODUCT,
  SERVE_SIM_PRODUCT,
} from "../product-identity";
import {
  inProcessDeviceServerState,
  listStateFiles,
  stateDirFor,
  stateFileForDevice,
  writeDeviceServerState,
} from "../state";

describe("parameterized state", () => {
  const simDir = stateDirFor(SERVE_SIM_PRODUCT);
  const deviceDir = stateDirFor(SERVE_DEVICE_PRODUCT);
  const udid = "TEST-RUNTIME-UDID-1111";

  beforeEach(() => {
    mkdirSync(simDir, { recursive: true });
    mkdirSync(deviceDir, { recursive: true });
  });

  afterEach(() => {
    for (const dir of [simDir, deviceDir]) {
      try {
        rmSync(join(dir, `server-${udid}.json`));
      } catch {}
    }
  });

  test("sim and device state dirs are distinct under tmpdir", () => {
    expect(simDir).toBe(join(tmpdir(), "serve-sim"));
    expect(deviceDir).toBe(join(tmpdir(), "serve-device"));
    expect(simDir).not.toBe(deviceDir);
  });

  test("writing device state does not appear in sim listStateFiles", () => {
    writeDeviceServerState(
      SERVE_DEVICE_PRODUCT,
      inProcessDeviceServerState(SERVE_DEVICE_PRODUCT, udid, 4200),
    );
    const simFiles = listStateFiles(SERVE_SIM_PRODUCT).filter((f) =>
      f.includes(udid),
    );
    const deviceFiles = listStateFiles(SERVE_DEVICE_PRODUCT).filter((f) =>
      f.includes(udid),
    );
    expect(deviceFiles.length).toBe(1);
    expect(simFiles.length).toBe(0);
    expect(existsSync(stateFileForDevice(SERVE_DEVICE_PRODUCT, udid))).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd packages/serve-runtime && bun test src/__tests__/state.test.ts
```

- [ ] **Step 3: Implement `state.ts`**

Port logic from `packages/serve-sim/src/state.ts`, threading `product` through every path. Keep atomic write (`tmp` + `renameSync`). Keep URL shape:

`http://{host}:{port}{prefix}/helper/{udid}/stream.mjpeg` and matching `wsUrl`.

Rename types:
- `ServeSimDeviceState` → `DeviceServerState`
- `inProcessServeSimState` → `inProcessDeviceServerState`
- `writeServeSimState` → `writeDeviceServerState`

- [ ] **Step 4: Export from index and run tests — expect PASS**

```bash
cd packages/serve-runtime && bun test src
```

- [ ] **Step 5: Commit**

```bash
git add packages/serve-runtime
git commit -m "$(cat <<'EOF'
feat(serve-runtime): add product-scoped device server state helpers

EOF
)"
```

---

### Task 4: `DeviceBackend` interface (TDD with fake)

**Files:**
- Create: `packages/serve-runtime/src/device-backend.ts`
- Create: `packages/serve-runtime/src/__tests__/device-backend.test.ts`
- Modify: `packages/serve-runtime/src/index.ts`

**Interfaces:**
- Produces (exact shapes — later plans must match):

```ts
import type { Transport } from "./product-identity";

/** Reserved for Android; v1 only ever returns "ios". */
export type DevicePlatform = "ios" | "android";

export type BackendKind = "simulator" | "device";

export interface ListedDevice {
  udid: string;
  name: string;
  platform: DevicePlatform;
  transport: Transport;
  /** True when the host can currently talk to the device (USB plugged / sim booted). */
  available: boolean;
}

export type HardwareButton =
  | "home"
  | "lock"
  | "side-button"
  | "siri"
  | "apple-pay";

export interface GesturePointEvent {
  type: "begin" | "move" | "end";
  x: number;
  y: number;
  /** Optional delay in ms before sending this event (CLI gesture JSON parity). */
  delay?: number;
}

export interface ScreenshotResult {
  /** PNG or JPEG bytes */
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg";
}

/**
 * Capability flags so CLI/UI can tell protocol-only vs agent-required features.
 * v1 device backend: touch/gesture often need WDA (`requiresAgent: true`).
 */
export interface BackendCapabilities {
  stream: boolean;
  tap: boolean;
  gesture: boolean;
  button: boolean;
  screenshot: boolean;
  installApp: boolean;
  launchApp: boolean;
  /** When true, tap/gesture/button may require on-device agent (WDA). */
  touchRequiresAgent: boolean;
}

export interface DeviceBackend {
  readonly kind: BackendKind;
  capabilities(): BackendCapabilities;

  listDevices(): Promise<ListedDevice[]>;
  /** Resolve name or UDID to UDID; throw Error with clear message if missing. */
  resolveDevice(nameOrUdid: string): Promise<string>;

  screenshot(udid: string): Promise<ScreenshotResult>;
  installApp(udid: string, appPath: string): Promise<void>;
  launchApp(udid: string, bundleId: string): Promise<void>;

  tap(udid: string, x: number, y: number): Promise<void>;
  gesture(udid: string, events: GesturePointEvent[]): Promise<void>;
  button(udid: string, name: HardwareButton): Promise<void>;
}
```

Note: live MJPEG/AVCC streaming stays outside this interface for Plan 1–2 (still owned by session/middleware). Plan 3 adds stream acquisition; do not invent a stream method here until Plan 3 needs it. If Plan 3 prefers a method on the backend, it will extend this interface in a follow-up commit inside Plan 3 — not here.

- [ ] **Step 1: Write failing test with an in-memory fake backend**

```ts
// packages/serve-runtime/src/__tests__/device-backend.test.ts
import { describe, expect, test } from "bun:test";
import type {
  BackendCapabilities,
  DeviceBackend,
  ListedDevice,
} from "../device-backend";

function fakeBackend(devices: ListedDevice[]): DeviceBackend {
  const caps: BackendCapabilities = {
    stream: true,
    tap: true,
    gesture: true,
    button: true,
    screenshot: true,
    installApp: true,
    launchApp: true,
    touchRequiresAgent: false,
  };
  return {
    kind: "device",
    capabilities: () => caps,
    async listDevices() {
      return devices;
    },
    async resolveDevice(nameOrUdid) {
      const hit = devices.find(
        (d) =>
          d.udid === nameOrUdid ||
          d.name.toLowerCase() === nameOrUdid.toLowerCase(),
      );
      if (!hit) throw new Error(`Could not resolve device: ${nameOrUdid}`);
      return hit.udid;
    },
    async screenshot() {
      return { bytes: Buffer.from("png"), contentType: "image/png" };
    },
    async installApp() {},
    async launchApp() {},
    async tap() {},
    async gesture() {},
    async button() {},
  };
}

describe("DeviceBackend contract", () => {
  test("resolveDevice matches by name case-insensitively", async () => {
    const backend = fakeBackend([
      {
        udid: "UDID-1",
        name: "Evan's iPhone",
        platform: "ios",
        transport: "usb",
        available: true,
      },
    ]);
    expect(await backend.resolveDevice("evan's iphone")).toBe("UDID-1");
    await expect(backend.resolveDevice("missing")).rejects.toThrow(
      /Could not resolve device/,
    );
  });

  test("device backend advertises touchRequiresAgent when set", () => {
    const backend = fakeBackend([]);
    expect(backend.capabilities().touchRequiresAgent).toBe(false);
    expect(backend.kind).toBe("device");
  });
});
```

- [ ] **Step 2: Run — expect FAIL (missing module)**

- [ ] **Step 3: Add `device-backend.ts` with types only + export from index**

No production backend implementation in `serve-runtime` itself.

- [ ] **Step 4: Run — expect PASS**

```bash
cd packages/serve-runtime && bun test src
```

- [ ] **Step 5: Commit**

```bash
git add packages/serve-runtime
git commit -m "$(cat <<'EOF'
feat(serve-runtime): define DeviceBackend contract and capability flags

EOF
)"
```

---

### Task 5: Wire `serve-sim` state to `serve-runtime` without behavior change

**Files:**
- Modify: `packages/serve-sim/package.json` — add `"serve-runtime": "workspace:*"`
- Modify: `packages/serve-sim/src/state.ts` — re-export / wrap with `SERVE_SIM_PRODUCT`
- Create: `packages/serve-sim/src/product.ts`
- Keep existing tests in `packages/serve-sim/src/__tests__/multi-device.test.ts` passing

**Interfaces:**
- Consumes: `SERVE_SIM_PRODUCT`, state helpers from `serve-runtime`
- Produces: existing export names from `state.ts` unchanged:
  - `STATE_DIR`, `STATE_FILE`, `stateFileForDevice`, `ServeSimDeviceState`, `inProcessServeSimState`, `writeServeSimState`, `listStateFiles`

- [ ] **Step 1: Add dependency and run existing multi-device test (baseline)**

```bash
# edit package.json dependencies, then:
bun install
cd packages/serve-sim && bun test src/__tests__/multi-device.test.ts
```

Expected: PASS (before code change).

- [ ] **Step 2: Rewrite `state.ts` as a binding layer**

```ts
import { tmpdir } from "os";
import { join } from "path";
import { SERVE_SIM_PRODUCT } from "serve-runtime";
import {
  inProcessDeviceServerState,
  listStateFiles as listStateFilesFor,
  stateDirFor,
  stateFileForDevice as stateFileForDeviceFor,
  writeDeviceServerState,
  type DeviceServerState,
} from "serve-runtime";

export const STATE_DIR = stateDirFor(SERVE_SIM_PRODUCT);
/** @deprecated Use stateFileForDevice(udid). */
export const STATE_FILE = join(STATE_DIR, "server.json");

export type ServeSimDeviceState = DeviceServerState;

export function stateFileForDevice(udid: string): string {
  return stateFileForDeviceFor(SERVE_SIM_PRODUCT, udid);
}

export function inProcessServeSimState(
  udid: string,
  port: number,
  base = "/",
  host = "127.0.0.1",
): ServeSimDeviceState {
  return inProcessDeviceServerState(SERVE_SIM_PRODUCT, udid, port, base, host);
}

export function writeServeSimState(state: ServeSimDeviceState): void {
  writeDeviceServerState(SERVE_SIM_PRODUCT, state);
}

export function listStateFiles(): string[] {
  return listStateFilesFor(SERVE_SIM_PRODUCT);
}

// Silence unused import if tmpdir only used historically — remove if unused.
void tmpdir;
```

Remove the unused `tmpdir` import if not needed.

Create `product.ts`:

```ts
export { SERVE_SIM_PRODUCT as PRODUCT } from "serve-runtime";
```

- [ ] **Step 3: Re-run multi-device + a quick smoke of state-dependent tests**

```bash
cd packages/serve-sim && bun test src/__tests__/multi-device.test.ts
```

Expected: PASS; `STATE_DIR` still ends with `/serve-sim`.

- [ ] **Step 4: Commit**

```bash
git add packages/serve-sim/package.json packages/serve-sim/src/state.ts packages/serve-sim/src/product.ts
git commit -m "$(cat <<'EOF'
refactor(serve-sim): bind state helpers to serve-runtime product identity

EOF
)"
```

---

### Task 6: `SimulatorDeviceBackend` adapter

**Files:**
- Create: `packages/serve-sim/src/backends/simulator-device-backend.ts`
- Create: `packages/serve-sim/src/__tests__/simulator-device-backend.test.ts`
- Optional thin use from `device.ts` later — do **not** rewrite all of `index.ts` CLI in this plan

**Interfaces:**
- Consumes: `DeviceBackend` from `serve-runtime`; existing `findBootedDevice` / `resolveDevice` patterns in `device.ts`
- Produces: `createSimulatorDeviceBackend(deps?: { execSync?: typeof execSync }): DeviceBackend`

Inject `execSync` for tests. Production default uses `node:child_process.execSync`.

`capabilities()` for simulator:

```ts
{
  stream: true,
  tap: true,
  gesture: true,
  button: true,
  screenshot: true,
  installApp: true,
  launchApp: true,
  touchRequiresAgent: false,
}
```

`listDevices`: parse `xcrun simctl list devices -j`; mark `available` when `state === "Booted"`; `transport: "usb"` is meaningless for sims — still set `"usb"` as the only v1 transport enum value (document in comment: simulators ignore transport). `platform: "ios"` for iOS runtimes only (skip watch/tv in list, matching `findBootedDevice` preference).

`tap` / `gesture` / `button` / `screenshot` / `installApp` / `launchApp`: for Plan 1, implement **only** `listDevices` + `resolveDevice` + `capabilities` fully; other methods should `throw new Error("SimulatorDeviceBackend: <method> not wired in Plan 1 — use existing serve-sim CLI paths")` so the adapter is honest. Plan 2+ will not rely on these methods for sim. Alternatively implement screenshot via `xcrun simctl io <udid> screenshot -` if easy — optional, not required for Plan 1 acceptance.

- [ ] **Step 1: Write test with mocked execSync returning a small simctl JSON fixture**

Fixture must include one Booted iPhone and one Shutdown iPhone; assert `listDevices` returns both with correct `available`, and `resolveDevice("iPhone 16")` returns the matching UDID.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement adapter**

- [ ] **Step 4: Run — PASS**

```bash
cd packages/serve-sim && bun test src/__tests__/simulator-device-backend.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/serve-sim/src/backends packages/serve-sim/src/__tests__/simulator-device-backend.test.ts
git commit -m "$(cat <<'EOF'
feat(serve-sim): add SimulatorDeviceBackend adapter over simctl list/resolve

EOF
)"
```

---

### Task 7: Plan 1 acceptance

- [ ] **Step 1: Run runtime + sim tests**

```bash
cd packages/serve-runtime && bun test src
cd packages/serve-sim && bun test src/__tests__/multi-device.test.ts src/__tests__/simulator-device-backend.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Confirm no `serve-device` package yet**

```bash
test ! -d packages/serve-device && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Confirm state isolation constants**

```bash
bun -e 'import { SERVE_DEVICE_PRODUCT, SERVE_SIM_PRODUCT } from "./packages/serve-runtime/src/index.ts";
console.log(SERVE_SIM_PRODUCT.stateDirName, SERVE_DEVICE_PRODUCT.stateDirName, SERVE_DEVICE_PRODUCT.defaultPreviewPort)'
```

Expected: `serve-sim serve-device 4200`.

---

## Plan 1 self-review

| Spec item | Task |
|---|---|
| Internal core/runtime package | Task 1 |
| Product isolation ports/state names | Task 2–3 |
| `DeviceBackend` + Android reserved in types | Task 4 (`DevicePlatform`) |
| Transport reserved (`usb` \| `wifi`) | Task 2 + Task 4 |
| serve-sim behavior preserved | Task 5 |
| Sim adapter exists for later swap | Task 6 |
| No serve-device / WDA / middleware yet | Explicit non-goals |

**Stop here.** Next: [Plan 2](./2026-07-28-serve-device-2-package-scaffold.md).
