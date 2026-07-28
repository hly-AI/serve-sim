# Workflows

Canonical human checklist (copy/paste commands, coexistence checks):  
[`packages/serve-device/README.md`](../../../packages/serve-device/README.md) → **Verification checklist (USB iPhone)**.

## First-time USB + WDA

1. `bash scripts/check-prereqs.sh`
2. Plug in iPhone, unlock, trust this computer, enable Developer Mode if prompted.
3. `npx serve-device doctor` — expect USB OK, WDA FAIL until setup.
4. `npx serve-device setup -d <udid> --team-id <TEAMID>`
5. If needed: `iproxy 8100 8100` (libimobiledevice) so WDA is on localhost:8100.
6. On device: trust developer certificate under Settings → General → VPN & Device Management.
7. `npx serve-device doctor` until WDA reachable.
8. `bash scripts/ensure-running.sh <udid>` then `npx serve-device tap 0.5 0.5 -d <udid>`.

## Verification (acceptance)

Mirror of the package README checklist — run in order:

1. `serve-device doctor -d <udid>` → `device.usb` OK, `wda.reachable` FAIL (before setup).
2. `serve-device setup -d <udid> --team-id <TEAM>` (+ trust cert / optional `iproxy 8100 8100`).
3. `serve-device doctor -d <udid>` → `wda.reachable` OK.
4. `serve-device -d <udid>` → browser at `:4200` shows updating frames.
5. `serve-device tap 0.5 0.5 -d <udid>` → visible center tap.
6. With serve-device running: `serve-sim --list` must **not** show device entries; `serve-device --list` shows port 4200.
7. `serve-device --kill` stops only serve-device (serve-sim keeps running if it was up).

From a monorepo checkout prefer the local binary:

```bash
bun run --filter serve-device build
node packages/serve-device/dist/serve-device.js doctor -d <udid>
```

## Coexistence with serve-sim

- serve-sim → `$TMPDIR/serve-sim`, port 3200
- serve-device → `$TMPDIR/serve-device`, port 4200
- `serve-device --kill` must not stop serve-sim (and vice versa).
