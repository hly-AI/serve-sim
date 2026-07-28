# serve-device: pymobiledevice3 screenshot fallback (Xcode 26)

## Goal

Stream / screenshot physical iOS devices on hosts without `devicectl device capture screenshot` (e.g. Xcode 26.5), without upgrading to Xcode 27.

## Approach (approved)

Screenshot capture order:

1. `xcrun devicectl device capture screenshot` (when present)
2. `idevicescreenshot` (legacy iOS)
3. `pymobiledevice3 developer dvt screenshot --userspace` (iOS 17+ / 26 primary path)

Normalize frames to JPEG via `sips` for MJPEG preview.

## Non-goals

- WDA / touch
- Pure-TS CoreDevice DTX client
- Bundling a full Python runtime in the npm package (host install of pymobiledevice3)

## Success

- `serve-device screenshot -d <device> -o out.png` works on Xcode 26.5 + iOS 26 USB
- Preview at `:4200` shows updating frames
- `doctor` reports missing pymobiledevice3 clearly when needed
