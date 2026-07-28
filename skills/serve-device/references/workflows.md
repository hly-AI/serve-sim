# Workflows

## First-time USB + WDA

1. `bash scripts/check-prereqs.sh`
2. Plug in iPhone, unlock, trust this computer, enable Developer Mode if prompted.
3. `npx serve-device doctor` — expect USB OK, WDA FAIL until setup.
4. `npx serve-device setup -d <udid> --team-id <TEAMID>`
5. If needed: `iproxy 8100 8100` (libimobiledevice) so WDA is on localhost:8100.
6. On device: trust developer certificate under Settings → General → VPN & Device Management.
7. `npx serve-device doctor` until WDA reachable.
8. `bash scripts/ensure-running.sh <udid>` then `npx serve-device tap 0.5 0.5 -d <udid>`.

## Coexistence with serve-sim

- serve-sim → `$TMPDIR/serve-sim`, port 3200
- serve-device → `$TMPDIR/serve-device`, port 4200
- `serve-device --kill` must not stop serve-sim (and vice versa).
