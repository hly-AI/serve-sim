# serve-device — Plan Index

> **Spec source:** grilling session shared understanding (2026-07-28).  
> **Do not implement Wi‑Fi, Android, middleware, camera, or permissions in these plans.**

This feature is four sequential plans. Each ends with working, testable software. Execute in order; do not start Plan N+1 until Plan N’s acceptance checks pass.

| # | Plan | Delivers |
|---|---|---|
| 1 | [Backend contract & product identity](./2026-07-28-serve-device-1-backend-contract.md) | Internal `serve-runtime` package: `DeviceBackend`, `ProductIdentity`, parameterized state; `serve-sim` still green |
| 2 | [Package scaffold & CLI mirror](./2026-07-28-serve-device-2-package-scaffold.md) | Publishable `serve-device` bin, isolated ports/state, mirrored CLI that talks to a stub backend |
| 3 | [iOS USB protocol backend](./2026-07-28-serve-device-3-ios-usb-backend.md) | `devicectl`-based list/install/launch/screenshot + MJPEG stream over USB |
| 4 | [WDA touch, setup/doctor, skills](./2026-07-28-serve-device-4-wda-skills-docs.md) | WDA-backed tap/gesture/button, `setup`/`doctor`, `skills/serve-device`, docs |

## Locked decisions (all plans)

- New npm package `serve-device` → `npx serve-device`
- v1: iOS physical only; Android reserved in types only
- Host: macOS only
- v1 features: list, stream, touch, hardware buttons, screenshot, install/launch
- Hybrid control: Apple CLI protocol first; WDA for touch/partial buttons
- Transport: v1 USB only; API reserves `wifi`
- Surface: mirror `serve-sim` CLI/UI/WS shapes
- Coexistence: separate default ports, `$TMPDIR/serve-device`, separate `--kill`, separate skill
- `serve-runtime` stays private (workspace); do not publish yet
- No middleware in v1
- Node `>=20`; kebab-case TS/JS files

## Default isolation constants

| | `serve-sim` (existing) | `serve-device` (new) |
|---|---|---|
| State dir | `$TMPDIR/serve-sim` | `$TMPDIR/serve-device` |
| Preview default port | `3200` | `4200` |
| Helper default port | `3100` | `4100` |
| npm bin | `serve-sim` | `serve-device` |

## Suggested execution

Use **subagent-driven-development** per plan (fresh subagent per task), or **executing-plans** inline with checkpoints after each plan.
