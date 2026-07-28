#!/usr/bin/env bash
# Verify the host satisfies serve-device's prerequisites.
# Exits 0 if everything is OK, 1 with a human message otherwise.

set -u

fail() {
  echo "serve-device prereq check failed: $1" >&2
  exit 1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "serve-device requires macOS. Detected: $(uname -s)."
fi

if ! command -v xcrun >/dev/null 2>&1; then
  fail "xcrun not found. Install Xcode command line tools: xcode-select --install"
fi

if ! xcrun devicectl --help >/dev/null 2>&1; then
  fail "devicectl not found via xcrun. Install a recent Xcode."
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node not found. Install Node.js 20 or newer (https://nodejs.org)."
fi
NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "node $NODE_MAJOR detected. serve-device requires Node.js 20+."
fi

# Warn (do not fail) when no physical devices are listed
if ! xcrun devicectl list devices 2>/dev/null | grep -qi "physical"; then
  echo "warning: no physical iOS devices listed. Plug in a USB iPhone and trust this computer." >&2
fi

echo "serve-device prereqs OK."
exit 0
