#!/usr/bin/env bash
# Ensure a serve-device preview is running for a USB iPhone.
# Idempotent: if one is already running, prints its URL JSON and exits 0.
# Usage: ensure-running.sh [device-name-or-udid]

set -u

DEVICE="${1:-}"

EXISTING="$(npx --yes serve-device --list -q 2>/dev/null || echo '[]')"
if [[ "$EXISTING" != "[]" && -n "$EXISTING" ]]; then
  if [[ -n "$DEVICE" ]]; then
    MATCH="$(echo "$EXISTING" | node -e "
      const arr = JSON.parse(require('fs').readFileSync(0, 'utf8'));
      const d = process.argv[1].toLowerCase();
      const m = arr.find(x => (x.device || '').toLowerCase().includes(d) || x.udid === d);
      if (m) console.log(JSON.stringify(m));
    " "$DEVICE")"
    if [[ -n "$MATCH" ]]; then
      echo "$MATCH"
      exit 0
    fi
  else
    echo "$EXISTING" | node -e "
      const arr = JSON.parse(require('fs').readFileSync(0, 'utf8'));
      if (arr[0]) console.log(JSON.stringify(arr[0]));
    "
    exit 0
  fi
fi

if [[ -n "$DEVICE" ]]; then
  npx --yes serve-device --detach -q -d "$DEVICE"
else
  npx --yes serve-device --detach -q
fi
