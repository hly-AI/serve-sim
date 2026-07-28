# serve-device

Stream and control a **physical iOS device** from the browser / CLI (`npx serve-device`).

Companion to [`serve-sim`](https://www.npmjs.com/package/serve-sim) (simulator-only). The two products use **separate** state directories and default ports so they can run side by side.

## Requirements

- **macOS only**
- Node.js **>= 20**
- Xcode / `xcrun` (for USB device tooling in later releases)
- **USB** connection for v1 (Wi‑Fi transport is planned, not ready yet)

## Scope (current)

| Capability | Status |
|---|---|
| Isolated CLI / state / ports | Ready |
| USB list / screenshot / install / launch / stream | Coming (Plan 3) |
| Touch / gesture / buttons via WebDriverAgent | Coming (Plan 4) — run `serve-device setup` then `doctor` |
| Expo / Connect middleware | Not in v1 |
| Android | Not in v1 |

Touch requires an on-device **WebDriverAgent** helper once Plan 4 lands. This package does **not** share `$TMPDIR/serve-sim` with `serve-sim`; device state lives under `$TMPDIR/serve-device`. Default preview port is **4200** (sim uses 3200).

## Quick start

```bash
npx serve-device --help
npx serve-device doctor
```
