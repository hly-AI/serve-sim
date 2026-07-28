---
name: serve-device
description: Control and stream a physical iOS device with npx serve-device over USB. Use for device preview, taps/gestures via WebDriverAgent, hardware home button, screenshots, install/launch.
license: Apache-2.0
---

# serve-device

Drive a **physical iOS device** (USB) using `npx serve-device`. Companion to `serve-sim` (simulator-only). State and ports are isolated (`$TMPDIR/serve-device`, default preview **4200**).

## When to use

- Stream a plugged-in iPhone/iPad to a browser.
- Tap / swipe / press home via CLI after WebDriverAgent is set up.
- Install or launch an app on hardware with `devicectl`.

## When NOT to use

- Apple Simulator → use `npx serve-sim` / the `serve-sim` skill.
- Android → use `adb`.
- Camera injection, permissions, AX tree, Expo middleware → **not supported yet** on serve-device.
- Wi‑Fi-only device control → not in v1 (USB only).

## Prerequisites

Run `scripts/check-prereqs.sh` first.

| Requirement | Why |
|---|---|
| macOS + Xcode / `devicectl` | USB device control |
| Node.js ≥ 20 | CLI runtime |
| USB cable + trust dialog | Device pairing |
| WebDriverAgent (`serve-device setup`) | Touch / gesture / buttons |

## Mental model

```text
USB iPhone ──devicectl──► serve-device (MJPEG :4200)
                │
                └── WDA :8100 (tap/gesture/button)
```

- Coordinates are **normalized 0..1** (same as serve-sim).
- State: `$TMPDIR/serve-device/server-{udid}.json`
- Do **not** call `serve-sim` for hardware.

## Common operations

| Goal | Command |
|---|---|
| Doctor | `npx serve-device doctor [-d udid]` |
| Setup WDA | `npx serve-device setup -d <udid> --team-id <TEAM>` |
| Preview | `npx serve-device -d <udid>` |
| Detach | `npx serve-device --detach -d <udid> -q` |
| Tap | `npx serve-device tap 0.5 0.5 -d <udid>` |
| Gesture | `npx serve-device gesture '<json>' -d <udid>` |
| Screenshot | `npx serve-device screenshot -d <udid> -o out.png` |
| Install / launch | `npx serve-device install <app> -d <udid>` / `launch <bundleId>` |

See [references/workflows.md](references/workflows.md) and [references/gestures.md](references/gestures.md).
