# device-see

Stream a **physical iOS device** to the browser (`npx device-see`).

Companion to [`serve-sim`](https://www.npmjs.com/package/serve-sim) (simulator-only). State lives under `$TMPDIR/serve-device`; default preview port **4200** (sim uses 3200). The CLI also accepts the alias `serve-device`.

## Install / run (no clone)

```bash
npx device-see -d <udid|name>
# → http://localhost:4200
```

### One-time screenshot backend (Xcode 26 / iOS 17+)

Apple’s `devicectl capture screenshot` is missing on some Xcode builds. Install the fallback once per Mac:

```bash
brew install python@3.12
python3.12 -m venv ~/Library/Caches/serve-device/pmd3-venv
~/Library/Caches/serve-device/pmd3-venv/bin/pip install -U pymobiledevice3
```

Optional: `export SERVE_DEVICE_PMD3=/path/to/pymobiledevice3`.

## Requirements

- **macOS only** + Xcode / `xcrun devicectl`
- Node.js **>= 20**
- **USB** connection for v1
- Screenshot tools above (when Xcode has no `device capture`)
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
npx device-see doctor -d <udid>
npx device-see -d <udid>          # http://localhost:4200
npx device-see screenshot -d <udid> -o /tmp/phone.jpg
```

## Quick start (with touch)

```bash
npx device-see setup -d <udid> --team-id <TEAMID>
# optional: iproxy 8100 8100
npx device-see -d <udid>
npx device-see tap 0.5 0.5 -d <udid>
```

## Publish (maintainers)

From this package directory, with npm login:

```bash
bun install
bun run build
npm publish --access public
```

## Verification checklist (USB iPhone)

From a local monorepo checkout:

```bash
bun install
bun run --filter device-see build
CLI="node packages/serve-device/dist/device-see.js"
UDID="<your-device-udid>"
```

1. `$CLI doctor -d "$UDID"` — expect `device.usb` OK and `screenshot.pmd3` OK (WDA may FAIL).
2. `$CLI -d "$UDID" -p 4200` — open http://localhost:4200; frames should update.
3. `$CLI screenshot -d "$UDID" -o /tmp/device.png`

Touch / WDA steps remain optional; see historical `serve-device` docs in git history if needed.

### Troubleshooting

- **Black preview / no frames** — install pymobiledevice3 venv above; unlock phone; run `xcrun devicectl device info ddiServices --device <udid>` once.
- **USB listed but tunnel unavailable** — unlock phone, re-plug, trust computer, enable Developer Mode.
- **WDA not reachable** — only needed for tap/gesture; run `setup` + trust cert / `iproxy 8100 8100`.
