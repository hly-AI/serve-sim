# serve-device

Stream and control a **physical iOS device** from the browser / CLI (`npx serve-device`).

Companion to [`serve-sim`](https://www.npmjs.com/package/serve-sim) (simulator-only). The two products use **separate** state directories and default ports so they can run side by side.

## Requirements

- **macOS only**
- Node.js **>= 20**
- Xcode / `xcrun devicectl`
- **USB** connection for v1 (Wi‑Fi transport is planned, not ready yet)

## Scope (current)

| Capability | Status |
|---|---|
| Isolated CLI / state / ports | Ready |
| USB list / screenshot / install / launch / MJPEG stream | Ready (`devicectl`) |
| Touch / gesture / buttons via WebDriverAgent | Coming (Plan 4) — `serve-device setup` then `doctor` |
| Expo / Connect middleware | Not in v1 |
| Android | Not in v1 |

Default preview port is **4200**; state under `$TMPDIR/serve-device`.

## Quick start

```bash
# prerequisites
npx serve-device doctor

# stream a plugged-in USB iPhone (MJPEG preview)
npx serve-device -d <udid-or-name>

# one-shot screenshot / install / launch
npx serve-device screenshot -d <udid> -o /tmp/phone.png
npx serve-device install /path/to/App.app -d <udid>
npx serve-device launch com.example.app -d <udid>
```

Touch (`tap` / `gesture` / `button`) requires WebDriverAgent (next release).

Integration tests that talk to a real phone: set `SERVE_DEVICE_USB_UDID` and run `bun test` in this package.
