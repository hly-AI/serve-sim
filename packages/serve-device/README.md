# serve-device

Stream and control a **physical iOS device** from the browser / CLI (`npx serve-device`).

Companion to [`serve-sim`](https://www.npmjs.com/package/serve-sim) (simulator-only). Separate state (`$TMPDIR/serve-device`) and default preview port **4200** (sim uses 3200).

## Requirements

- **macOS only** + Xcode / `xcrun devicectl`
- Node.js **>= 20**
- **USB** connection for v1 (Wi‑Fi later)
- Apple Developer **Team ID** + WebDriverAgent for touch

## Scope

| Capability | Status |
|---|---|
| USB list / screenshot / install / launch / MJPEG stream | Ready |
| Touch / gesture / home via WDA | Ready after `setup` |
| Expo middleware | Not in v1 |
| Camera / permissions / AX | Not in v1 |
| Android / Wi‑Fi transport | Not in v1 |

## Quick start

```bash
npx serve-device doctor
npx serve-device setup -d <udid> --team-id <TEAMID>
# optional: iproxy 8100 8100
npx serve-device -d <udid>          # http://localhost:4200
npx serve-device tap 0.5 0.5 -d <udid>
```

### Troubleshooting

- **USB listed but tunnel unavailable** — unlock phone, re-plug cable, trust computer, enable Developer Mode.
- **WDA not reachable** — re-run `setup`; trust the developer cert on device; forward 8100 with `iproxy` if needed; set `SERVE_DEVICE_WDA_URL`.
- **xcodebuild signing errors** — open `WebDriverAgent.xcodeproj` in Xcode once, select your team, then re-run setup.
- First-run is **not fully non-interactive**: accept Trust / Developer Mode dialogs on the phone.

Integration tests: `SERVE_DEVICE_USB_UDID=<udid> bun test` in this package.
