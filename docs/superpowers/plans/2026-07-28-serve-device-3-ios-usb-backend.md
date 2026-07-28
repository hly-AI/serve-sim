# serve-device Plan 3: iOS USB Protocol Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Index:** [overview](./2026-07-28-serve-device-overview.md)  
> **Requires:** Plans 1–2 complete.

**Goal:** Replace the stub with a real `IosUsbDeviceBackend` using Apple’s `xcrun devicectl` (and related tools) for list / resolve / screenshot / install / launch, plus a USB MJPEG preview path so `serve-device` can stream frames in-process.

**Architecture:** Protocol methods live in `packages/serve-device/src/backends/ios-usb-device-backend.ts` behind `DeviceBackend`. Streaming uses a new `DeviceCaptureSession` (device analogue of `DeviceSession`) that polls or pulls JPEG frames over USB and fans them out as `multipart/x-mixed-replace` on `/helper/<udid>/stream.mjpeg`. Touch methods still throw “needs WDA (Plan 4)” with `touchRequiresAgent: true`. Preview UI: either (a) vendor a minimal HTML that only shows MJPEG + status, or (b) extract/share the existing client — prefer **(a) minimal stream page** in Plan 3 to avoid a full UI move; Plan 4 can deepen parity.

**Tech Stack:** `xcrun devicectl`, optional `idevicescreenshot` / screenshot via `devicectl` if available, Node HTTP, existing MJPEG framing patterns from `device-session.ts`.

## Global Constraints

- USB only; if code paths accept `transport`, reject or ignore `wifi`.
- Prefer `devicectl`; wrap subprocesses; parse JSON where `devicectl … -j` / `--json-output` exists.
- No WDA install/touch in this plan.
- No Wi‑Fi pairing automation.
- Tests: unit-test parsers with fixtures; integration tests gated behind `SERVE_DEVICE_USB_UDID` env (skip if unset).

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/serve-device/src/backends/devicectl.ts` | Low-level `devicectl` exec + JSON parse |
| `packages/serve-device/src/backends/ios-usb-device-backend.ts` | `DeviceBackend` implementation |
| `packages/serve-device/src/backends/fixtures/devicectl-list.json` | Golden list fixture |
| `packages/serve-device/src/session/device-capture-session.ts` | MJPEG fan-out from screenshot puller |
| `packages/serve-device/src/server/preview-server.ts` | HTTP server: stream + health + static minimal UI |
| `packages/serve-device/src/server/minimal-preview.html` | Minimal `<img>` MJPEG page |
| `packages/serve-device/src/__tests__/devicectl-parse.test.ts` | Parser tests |
| `packages/serve-device/src/__tests__/ios-usb-backend.test.ts` | Backend with mocked exec |
| `packages/serve-device/src/__tests__/device-capture-session.test.ts` | MJPEG boundary framing unit test |
| Modify: `src/index.ts` | Wire real backend; implement default serve / `--detach` |

---

### Task 1: `devicectl` wrappers + fixtures (TDD)

**Files:**
- Create: `packages/serve-device/src/backends/devicectl.ts`
- Create: `packages/serve-device/src/backends/fixtures/devicectl-list.json`
- Create: `packages/serve-device/src/__tests__/devicectl-parse.test.ts`

**Interfaces:**

```ts
export interface DevicectlDevice {
  udid: string;
  name: string;
  connectionProperties?: {
    transportType?: string; // e.g. "wired"
    tunnelState?: string;
  };
  // keep other fields optional / unknown
}

export function parseDevicectlListDevicesJson(raw: string): DevicectlDevice[];
export function runDevicectl(args: string[], opts?: { execSync?: typeof execSync }): string;
```

Discover the actual JSON shape on a developer Mac:

```bash
xcrun devicectl list devices --json-output /tmp/devices.json
# or: xcrun devicectl list devices -j
cat /tmp/devices.json | head
```

Check the real schema **before** writing the fixture; adjust field paths in the parser to match Apple’s output (they change across Xcode versions). Document the chosen paths in a comment atop `devicectl.ts`.

- [ ] **Step 1: Capture a redacted fixture from a real machine (or synthesize matching Apple’s schema)**

- [ ] **Step 2: Failing tests for `parseDevicectlListDevicesJson`**

Assert UDID/name extraction and that wireless-only entries can be filtered when `transportType` indicates network — v1 `listDevices` returns **wired/USB available** devices only (include devices with unknown transport if connection is present; exclude clearly `network` / wifi-only if distinguishable).

- [ ] **Step 3: Implement parser + `runDevicectl`**

`runDevicectl(["device", "info", …])` etc. Throw `Error` including stderr on non-zero status.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): add devicectl list JSON parser and exec helper

EOF
)"
```

---

### Task 2: `IosUsbDeviceBackend` protocol methods (TDD)

**Files:**
- Create: `packages/serve-device/src/backends/ios-usb-device-backend.ts`
- Create: `packages/serve-device/src/__tests__/ios-usb-backend.test.ts`
- Modify: stub usage in `index.ts` to prefer real backend

**Interfaces:**

```ts
export function createIosUsbDeviceBackend(deps?: {
  runDevicectl?: typeof runDevicectl;
  screenshotToBuffer?: (udid: string) => Promise<Buffer>;
}): DeviceBackend;
```

Method mapping (verify exact `devicectl` subcommands against local Xcode `devicectl help` and encode the verified argv arrays in code comments):

| Method | Intended tool |
|---|---|
| `listDevices` | `devicectl list devices` JSON → `ListedDevice[]` with `transport: "usb"`, `platform: "ios"` |
| `resolveDevice` | match name/udid from list |
| `screenshot` | Prefer `devicectl device screenshot … --device <udid>` writing to temp file, read bytes; fallback documented if CLI differs |
| `installApp` | `devicectl device install app --device <udid> <path>` |
| `launchApp` | `devicectl device process launch --device <udid> <bundleId>` (confirm flags) |
| `tap` / `gesture` / `button` | throw `Error` with message containing `WDA` and `serve-device setup` |

`capabilities()`:

```ts
{
  stream: true,
  tap: true,
  gesture: true,
  button: true,
  screenshot: true,
  installApp: true,
  launchApp: true,
  touchRequiresAgent: true,
}
```

- [ ] **Step 1: Tests with mocked `runDevicectl`** for list/resolve/install/launch argv and tap error

- [ ] **Step 2: Implement backend**

- [ ] **Step 3: Optional integration test**

```ts
const udid = process.env.SERVE_DEVICE_USB_UDID;
const describeUsb = udid ? describe : describe.skip;
describeUsb("usb integration", () => {
  test("listDevices includes env udid", async () => {
    const b = createIosUsbDeviceBackend();
    const list = await b.listDevices();
    expect(list.some((d) => d.udid === udid)).toBe(true);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): implement IosUsbDeviceBackend via devicectl

EOF
)"
```

---

### Task 3: Screenshot puller → MJPEG session (TDD)

**Files:**
- Create: `packages/serve-device/src/session/device-capture-session.ts`
- Create: `packages/serve-device/src/__tests__/device-capture-session.test.ts`

**Interfaces:**

```ts
export interface FrameSource {
  /** Return one JPEG buffer; called on an interval while clients are connected. */
  capture(): Promise<Buffer>;
}

export class DeviceCaptureSession {
  constructor(udid: string, source: FrameSource, opts?: { fps?: number });
  handleMjpeg(req: IncomingMessage, res: ServerResponse): void;
  handleHealth(req: IncomingMessage, res: ServerResponse): void;
  close(): void;
}
```

MJPEG framing: copy boundary style from `packages/serve-sim/src/device-session.ts` (multipart headers + `--Boundary` + `Content-Type: image/jpeg`). Default `fps: 5` for USB screenshot pull (tunable). When no clients, do not hammer the device (stop timer).

- [ ] **Step 1: Unit test with a fake `FrameSource` that returns a tiny JPEG buffer; assert response writes include `multipart/x-mixed-replace` and the jpeg bytes at least once** (use `MockResponse` or record chunks)

- [ ] **Step 2: Implement session**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): add DeviceCaptureSession MJPEG fan-out from frame source

EOF
)"
```

---

### Task 4: Preview HTTP server + minimal UI

**Files:**
- Create: `packages/serve-device/src/server/preview-server.ts`
- Create: `packages/serve-device/src/server/minimal-preview.html`
- Modify: `packages/serve-device/src/index.ts` default action / `--detach`
- Modify: `build.ts` to embed HTML (base64 define or readFileSync at runtime from beside dist)

**Interfaces:**
- `startPreviewServer(opts: { port: number; host: string; udid: string; backend: DeviceBackend }): Promise<{ port: number; stop: () => void }>`
- Routes:
  - `GET /` → minimal HTML
  - `GET /helper/:udid/stream.mjpeg` → session MJPEG
  - `GET /helper/:udid/health` → `{ status: "ok" }`
  - `GET /helper/:udid/config` → `{ width, height, orientation }` if known, else `{ width: 0, height: 0, orientation: "portrait" }`

On start: `writeServeDeviceState(inProcessServeDeviceState(udid, port, "/", host))`.  
On stop/exit: clear state file.

Default port: `PRODUCT.defaultPreviewPort` (`4200`).

- [ ] **Step 1: Implement server + HTML with `<img src="/helper/UDID/stream.mjpeg">` (inject udid)**

- [ ] **Step 2: Wire CLI**

```text
serve-device [-d udid] [-p port] [--host addr]
serve-device --detach [-d udid] [-p port]
```

`--detach` may spawn `node dist/serve-device.js …` child or reuse serve-sim’s detach pattern; keep state JSON compatible with `--list`.

- [ ] **Step 3: Manual USB test** (human / agent with device)

```bash
bun run packages/serve-device/build.ts
node packages/serve-device/dist/serve-device.js -d <UDID> -p 4200
# open http://127.0.0.1:4200 — expect updating frames
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): USB MJPEG preview server with minimal HTML shell

EOF
)"
```

---

### Task 5: Extend `DeviceBackend` with optional stream hook (only if needed)

If the preview server needs backend ownership of `FrameSource`, add to `serve-runtime`:

```ts
createFrameSource?(udid: string): FrameSource;
```

as an **optional** method on `DeviceBackend` (TypeScript optional property). Implement on `IosUsbDeviceBackend`; leave unimplemented on simulator adapter.

- [ ] **Step 1: Add optional method + test that USB backend provides it**

- [ ] **Step 2: Commit runtime + device packages together**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-runtime): optional DeviceBackend.createFrameSource for USB MJPEG

EOF
)"
```

If screenshot-pull `FrameSource` can live entirely inside `serve-device` without extending the interface, **skip this task** (YAGNI).

---

### Task 6: Plan 3 acceptance

- [ ] Unit tests green without a phone.
- [ ] With `SERVE_DEVICE_USB_UDID` set: list + screenshot + stream smoke documented in README.
- [ ] `tap` still fails with WDA message.
- [ ] `serve-sim --list` unaffected when only serve-device is running.

---

## Plan 3 self-review

| Spec item | Task |
|---|---|
| list / screenshot / install / launch | Task 2 |
| screen stream | Task 3–4 |
| USB only; wifi reserved | Task 1 filter + overview |
| Apple CLI preferred | Task 1–2 |
| Touch deferred to WDA | Task 2 throws |
| Isolated preview port 4200 | Task 4 |

**Stop here.** Next: [Plan 4](./2026-07-28-serve-device-4-wda-skills-docs.md).
