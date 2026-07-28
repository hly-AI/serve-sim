# serve-device

Stream and control a **physical iOS device** from the browser / CLI (`npx serve-device`).

Companion to [`serve-sim`](https://www.npmjs.com/package/serve-sim) (simulator-only). Separate state (`$TMPDIR/serve-device`) and default preview port **4200** (sim uses 3200).

## Requirements

- **macOS only** + Xcode / `xcrun devicectl`
- Node.js **>= 20**
- **USB** connection for v1 (Wi‑Fi later)
- **Screenshot tools** (for preview / `screenshot` on Xcode without `device capture`):
  Python **3.12+** + `pymobiledevice3` in the cache venv (see below)
- Apple Developer **Team ID** + WebDriverAgent for touch (optional if you only need stream)

## Scope

| Capability | Status |
|---|---|
| USB list / screenshot / install / launch / MJPEG stream | Ready |
| Touch / gesture / home via WDA | Ready after `setup` |
| Expo middleware | Not in v1 |
| Camera / permissions / AX | Not in v1 |
| Android / Wi‑Fi transport | Not in v1 |

## Quick start (stream only — no WDA)

```bash
# One-time screenshot backend (Xcode 26 / iOS 17+)
brew install python@3.12   # if needed
python3.12 -m venv ~/Library/Caches/serve-device/pmd3-venv
~/Library/Caches/serve-device/pmd3-venv/bin/pip install -U pymobiledevice3

npx serve-device doctor -d <udid>
npx serve-device -d <udid>          # http://localhost:4200
```

Override binary path with `SERVE_DEVICE_PMD3=/path/to/pymobiledevice3`.

## Quick start (with touch)

```bash
npx serve-device doctor
npx serve-device setup -d <udid> --team-id <TEAMID>
# optional: iproxy 8100 8100
npx serve-device -d <udid>          # http://localhost:4200
npx serve-device tap 0.5 0.5 -d <udid>
```

## Verification checklist (USB iPhone)

Use this on a Mac with a plugged-in device and a signing Team ID. From a local checkout of this monorepo:

```bash
# build the local CLI (prefer this over a published npx until published)
bun install
bun run --filter serve-device build
CLI="node packages/serve-device/dist/serve-device.js"
UDID="<your-device-udid>"   # from: xcrun devicectl list devices
TEAM="<your-team-id>"
```

1. **Doctor before setup** — USB should pass; WDA should fail:
   ```bash
   $CLI doctor -d "$UDID"
   # expect: device.usb OK, wda.reachable FAIL
   ```
2. **Setup WebDriverAgent** (interactive Trust / signing dialogs may appear):
   ```bash
   $CLI setup -d "$UDID" --team-id "$TEAM"
   # On device: Settings → General → VPN & Device Management → trust developer
   # If WDA is not on localhost:8100: iproxy 8100 8100
   ```
3. **Doctor after setup** — WDA should pass:
   ```bash
   $CLI doctor -d "$UDID"
   # expect: wda.reachable OK (and ideally wda.session OK)
   ```
4. **Preview stream** — open the printed URL; frames should update:
   ```bash
   $CLI -d "$UDID" -p 4200
   # → http://localhost:4200
   ```
5. **Tap** (in another terminal, with WDA still up):
   ```bash
   $CLI tap 0.5 0.5 -d "$UDID"
   # expect a visible tap at screen center
   ```
6. **Coexistence with serve-sim** — while serve-device is running:
   ```bash
   npx serve-sim --list    # sim-only / empty — must not list serve-device entries
   $CLI --list             # shows the device server on port 4200
   $CLI --kill             # stops serve-device only; does not stop serve-sim
   ```

Agent-oriented copy of this flow: [`skills/serve-device/references/workflows.md`](../../skills/serve-device/references/workflows.md).

### Troubleshooting

- **USB listed but tunnel unavailable** — unlock phone, re-plug cable, trust computer, enable Developer Mode.
- **WDA not reachable** — re-run `setup`; trust the developer cert on device; forward 8100 with `iproxy` if needed; set `SERVE_DEVICE_WDA_URL`.
- **xcodebuild signing errors** — open `WebDriverAgent.xcodeproj` in Xcode once, select your team, then re-run setup.
- First-run is **not fully non-interactive**: accept Trust / Developer Mode dialogs on the phone.

Integration tests: `SERVE_DEVICE_USB_UDID=<udid> bun test` in this package.
