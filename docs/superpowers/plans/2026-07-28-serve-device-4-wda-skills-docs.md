# serve-device Plan 4: WDA Touch, setup/doctor, Skills & Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Index:** [overview](./2026-07-28-serve-device-overview.md)  
> **Requires:** Plans 1–3 complete.

**Goal:** Enable tap / gesture / hardware buttons via WebDriverAgent, add `serve-device setup` + full `doctor`, ship `skills/serve-device`, and update root/package docs so agents and humans can run the USB+WDA path end-to-end.

**Architecture:** A `WdaClient` talks to WDA’s HTTP API (default `localhost` forwarded port). `IosUsbDeviceBackend` gains a `WdaClient` dependency for `tap` / `gesture` / `button`. `setup` clones or uses a configured WDA path, runs `xcodebuild` for the connected device UDID, and installs/launches WDA. USB port forwarding uses `iproxy` (libimobiledevice) or `devicectl device process forward` — **verify on target Xcode** and encode the working argv; prefer documenting one primary path in `doctor`.

**Tech Stack:** WebDriverAgent HTTP (`/session`, `/wda/tap`, `/wda/pressButton`, W3C actions), `xcodebuild`, existing Commander CLI.

## Global Constraints

- Do not distribute prebuilt IPA / re-signed WDA binaries.
- User must have a valid Apple developer signing identity; `setup` guides but does not bypass Gatekeeper/signing.
- Coordinates remain **normalized 0..1** like `serve-sim tap` (convert to pixels using WDA window size).
- No middleware; no Wi‑Fi implementation; no Android.
- Update `skills/serve-sim/SKILL.md` “When NOT to use” so real devices point at `serve-device`, not only raw `devicectl`.

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/serve-device/src/wda/wda-client.ts` | HTTP client for WDA |
| `packages/serve-device/src/wda/wda-gesture.ts` | Map gesture JSON → WDA actions / taps |
| `packages/serve-device/src/wda/setup.ts` | `setup` orchestration |
| `packages/serve-device/src/cli/doctor.ts` | Full doctor checks |
| `packages/serve-device/src/__tests__/wda-client.test.ts` | Mock HTTP |
| `packages/serve-device/src/__tests__/wda-gesture.test.ts` | Coordinate math |
| Modify: `ios-usb-device-backend.ts` | Use WDA when available |
| `skills/serve-device/**` | Agent skill mirror |
| `packages/serve-device/README.md` | End-to-end USB+WDA |
| `README.md` (repo root) | Link both products |
| Modify: `skills/serve-sim/SKILL.md` | Point hardware → serve-device |

---

### Task 1: `WdaClient` (TDD)

**Files:**
- Create: `packages/serve-device/src/wda/wda-client.ts`
- Create: `packages/serve-device/src/__tests__/wda-client.test.ts`

**Interfaces:**

```ts
export interface WdaClientOptions {
  /** Base URL, e.g. http://127.0.0.1:8100 */
  baseUrl: string;
  fetch?: typeof fetch;
}

export class WdaClient {
  constructor(opts: WdaClientOptions);
  /** Create session if needed; return session id */
  ensureSession(): Promise<string>;
  getWindowSize(): Promise<{ width: number; height: number }>;
  /** Normalized 0..1 → pixel tap */
  tap(x: number, y: number): Promise<void>;
  /** Press WDA button name: home, volumeUp, volumeDown, etc. Map HardwareButton → WDA */
  pressButton(name: HardwareButton): Promise<void>;
  /** Perform drag using W3C actions or WDA drag endpoint */
  performGesture(events: GesturePointEvent[]): Promise<void>;
  status(): Promise<{ ready: boolean; detail: string }>;
}
```

Use WDA endpoints (confirm against current WDA docs while implementing; adjust paths if upstream renamed):

- `GET /status`
- `POST /session` with capabilities `{"capabilities":{"alwaysMatch":{"platformName":"iOS"}}}` (simplify as needed)
- `GET /session/:id/window/size`
- `POST /session/:id/wda/tap` or pointer actions
- `POST /session/:id/wda/pressButton` with `{ name: "home" }`

- [ ] **Step 1: Mock `fetch` tests for tap coordinate conversion**

Given window 390×844 and normalized `(0.5, 0.5)`, assert request body uses pixel coords ≈ `(195, 422)` (integer rounding documented).

- [ ] **Step 2: Implement client**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): add WebDriverAgent HTTP client with normalized taps

EOF
)"
```

---

### Task 2: Wire WDA into `IosUsbDeviceBackend`

**Files:**
- Modify: `packages/serve-device/src/backends/ios-usb-device-backend.ts`
- Create: `packages/serve-device/src/wda/wda-gesture.ts`
- Create: `packages/serve-device/src/__tests__/wda-gesture.test.ts`

**Interfaces:**
- `createIosUsbDeviceBackend({ wda?: WdaClient | (() => Promise<WdaClient>) })`
- If WDA `status().ready`, `tap`/`gesture`/`button` delegate to WDA
- If not ready, throw:

```ts
new Error(
  "Touch requires WebDriverAgent. Run `serve-device setup -d <udid>` then `serve-device doctor`.",
)
```

Gesture JSON: accept the same array shape `serve-sim gesture` uses (`begin`/`move`/`end` with `x`,`y`,`delay?`). Implement by collapsing to a drag between first begin and last end if intermediate moves exist; otherwise single tap. Test that mapping in `wda-gesture.test.ts`.

Hardware button map:

| HardwareButton | WDA name (verify) |
|---|---|
| `home` | `home` |
| `lock` | may map to lock/xlatch — if unsupported, throw clear “unsupported on device/WDA” |
| `side-button` | map or unsupported |
| `siri` / `apple-pay` | unsupported → explicit error |

- [ ] **Step 1: Tests for gesture collapse + unsupported buttons**

- [ ] **Step 2: Implement + wire CLI (already calls backend)**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): route tap/gesture/button through WebDriverAgent

EOF
)"
```

---

### Task 3: `serve-device setup` + full `doctor`

**Files:**
- Create: `packages/serve-device/src/wda/setup.ts`
- Create: `packages/serve-device/src/cli/doctor.ts`
- Modify: `src/index.ts`

**Interfaces:**

```ts
export interface DoctorReport {
  ok: boolean;
  checks: Array<{ id: string; ok: boolean; message: string }>;
}

export async function runDoctor(opts: {
  udid?: string;
  wdaBaseUrl?: string;
}): Promise<DoctorReport>;

export async function runSetup(opts: {
  udid: string;
  /** Local path to WebDriverAgent repo; default clone under cache dir */
  wdaPath?: string;
  /** xcodebuild CODE_SIGN_IDENTITY / development team env */
  teamId?: string;
}): Promise<void>;
```

Doctor checks (each becomes a `checks[]` entry):

1. `host.darwin` — `uname` Darwin  
2. `host.node` — Node >= 20  
3. `host.xcrun` — `xcrun` exists  
4. `host.devicectl` — `xcrun devicectl version` or `help` exits 0  
5. `device.usb` — `listDevices()` non-empty / requested UDID available  
6. `wda.reachable` — `GET {baseUrl}/status`  
7. `wda.session` — optional deeper check  

Print human-readable summary; exit 1 if any required check fails. JSON via `--json` flag.

Setup steps (implement as orchestrated shell + clear logs):

1. Resolve UDID  
2. Ensure WDA sources (clone `https://github.com/appium/WebDriverAgent` into `$TMPDIR/serve-device/wda` or `~/Library/Caches/serve-device/wda` if missing)  
3. Instruct / accept `TEAM_ID` via `--team-id` or env `SERVE_DEVICE_TEAM_ID`  
4. Run `xcodebuild` for platform `iOS`, destination `id=<udid>`, scheme `WebDriverAgentRunner` (confirm scheme name in cloned repo)  
5. Start WDA test runner / launch and print forwarded URL  
6. Tell user to re-run `serve-device doctor`

Do **not** claim setup is fully non-interactive if Xcode requires first-time GUI trust — print the exact dialog the user must accept.

- [ ] **Step 1: Doctor unit tests with injectable checkers**

- [ ] **Step 2: Implement doctor + setup**

- [ ] **Step 3: Manual path on a signed Mac** (document results in commit message or README troubleshooting)

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(serve-device): add setup and doctor for WDA signing and USB readiness

EOF
)"
```

---

### Task 4: `skills/serve-device`

**Files:**
- Create: `skills/serve-device/SKILL.md`
- Create: `skills/serve-device/scripts/check-prereqs.sh`
- Create: `skills/serve-device/scripts/ensure-running.sh`
- Create: `skills/serve-device/references/workflows.md`
- Create: `skills/serve-device/references/gestures.md` (can adapt from serve-sim; note WDA)  
- Create: `skills/serve-device/evals/evals.json` (2–4 eval prompts)
- Create: `skills/serve-device/README.md`

**Interfaces / content requirements:**
- `check-prereqs.sh`: Darwin, xcrun, Node >=20, warn if no USB device via `devicectl`  
- `ensure-running.sh`: `npx --yes serve-device --list` then `--detach` (mirror serve-sim script; **must not** call `serve-sim`)  
- SKILL.md: when to use / not use; mental model USB + WDA; point camera/permissions to “not supported yet”  
- Eval: “stream my plugged-in iPhone and tap the center”

- [ ] **Step 1: Copy structure from `skills/serve-sim`, rewrite all bin names and state paths**

- [ ] **Step 2: Fix serve-sim skill cross-link**

In `skills/serve-sim/SKILL.md` under “When NOT to use”, change real-device line to:

```markdown
- Real iOS hardware devices → use `npx serve-device` (this skill is simulator-only).
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs(skills): add serve-device skill and point hardware users away from serve-sim

EOF
)"
```

---

### Task 5: Package + root documentation

**Files:**
- Modify: `packages/serve-device/README.md`
- Modify: `README.md` (repo root) — short section “Simulator vs Device”
- Modify: `packages/serve-sim/README.md` — link to serve-device for hardware

Must state explicitly:

- v1 USB only; Wi‑Fi later  
- Touch needs WDA + `setup`  
- Default port 4200; state `$TMPDIR/serve-device`  
- Does not conflict with serve-sim on 3200  
- No Expo middleware yet  

- [ ] **Step 1: Edit docs**

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: document serve-device USB+WDA workflow and coexistence with serve-sim

EOF
)"
```

---

### Task 6: End-to-end acceptance

- [ ] **Step 1: Automated**

```bash
cd packages/serve-runtime && bun test src
cd packages/serve-device && bun test src
cd packages/serve-sim && bun test src/__tests__/multi-device.test.ts src/__tests__/simulator-device-backend.test.ts
```

- [ ] **Step 2: Manual checklist (USB iPhone + signing)**

1. `serve-device doctor` → fails on WDA until setup  
2. `serve-device setup -d <udid> --team-id <TEAM>`  
3. `serve-device doctor` → ok  
4. `serve-device -d <udid>` → browser shows frames  
5. `serve-device tap 0.5 0.5 -d <udid>` → visible tap  
6. `serve-sim --list` while device server runs → empty or sim-only (no device entries)  
7. `serve-device --kill` does not stop serve-sim  

- [ ] **Step 3: Final commit only if docs/scripts fixed during checklist**

---

## Out of scope (do not sneak in)

- Wi‑Fi transport implementation  
- Android backend  
- `serve-device/middleware` / Expo embed  
- Camera injection, permissions, UI settings parity  
- Publishing `serve-runtime` to npm  
- Full serve-sim web UI feature parity (AX panel, grid, tools) — optional follow-up plan

---

## Plan 4 self-review

| Spec item | Task |
|---|---|
| WDA for touch/buttons | Task 1–2 |
| `setup` / `doctor` | Task 3 |
| Isolated skill | Task 4 |
| Docs / coexistence | Task 5–6 |
| Mirror gesture/tap semantics | Task 2 |
| No prebuilt IPA | Task 3 constraints |

**Feature complete for grilling v1** when Task 6 checklist passes.
