/**
 * Wrappers around `xcrun devicectl`.
 *
 * JSON schema (jsonVersion 4, Xcode 16+/CoreDevice):
 *   { info: {...}, result: { devices: DevicectlDeviceRaw[] } }
 *
 * Per-device paths used by the parser:
 *   - hardwareProperties.udid          → udid
 *   - deviceProperties.name            → name
 *   - hardwareProperties.reality       → "physical" | "simulated"
 *   - hardwareProperties.platform      → "iOS" | ...
 *   - connectionProperties.transportType → "wired" | "localNetwork" | "sameMachine" | undefined
 *   - connectionProperties.tunnelState → "connected" | "disconnected" | "unavailable" | ...
 *   - identifier                       → CoreDevice UUID (also accepted by --device)
 *
 * Scripts MUST use `--json-output <path>`; stdout is not a stable machine API.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface DevicectlDevice {
  udid: string;
  name: string;
  /** CoreDevice identifier (UUID); accepted by `--device`. */
  identifier?: string;
  reality?: "physical" | "simulated" | string;
  platform?: string;
  connectionProperties?: {
    transportType?: string;
    tunnelState?: string;
    pairingState?: string;
  };
}

type ExecFileSyncFn = typeof execFileSync;

export function parseDevicectlListDevicesJson(raw: string): DevicectlDevice[] {
  const data = JSON.parse(raw) as {
    result?: {
      devices?: Array<{
        identifier?: string;
        connectionProperties?: DevicectlDevice["connectionProperties"];
        deviceProperties?: { name?: string };
        hardwareProperties?: {
          udid?: string;
          reality?: string;
          platform?: string;
        };
      }>;
    };
  };
  const devices = data.result?.devices ?? [];
  const out: DevicectlDevice[] = [];
  for (const d of devices) {
    const udid = d.hardwareProperties?.udid ?? d.identifier;
    if (!udid) continue;
    out.push({
      udid,
      name: d.deviceProperties?.name ?? udid,
      identifier: d.identifier,
      reality: d.hardwareProperties?.reality,
      platform: d.hardwareProperties?.platform,
      connectionProperties: d.connectionProperties,
    });
  }
  return out;
}

/** True when transport is clearly Wi‑Fi / network (v1 USB filter excludes these). */
export function isNetworkTransport(transportType: string | undefined): boolean {
  if (!transportType) return false;
  return /network|wifi|wireless/i.test(transportType);
}

/** True when the device looks currently reachable over a CoreDevice tunnel. */
export function isTunnelConnected(tunnelState: string | undefined): boolean {
  if (!tunnelState) return false;
  return /^(connected|available)$/i.test(tunnelState);
}

/**
 * Run `xcrun devicectl <args…>` with `--json-output` to a temp file and return
 * the JSON file contents as a string. Throws Error including stderr on failure.
 */
export function runDevicectl(
  args: string[],
  opts?: { execFileSync?: ExecFileSyncFn },
): string {
  const exec = opts?.execFileSync ?? execFileSync;
  const dir = mkdtempSync(join(tmpdir(), "serve-device-devicectl-"));
  const jsonPath = join(dir, "out.json");
  try {
    try {
      exec("xcrun", ["devicectl", ...args, "--json-output", jsonPath], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const e = err as {
        stderr?: string | Buffer;
        message?: string;
        status?: number;
      };
      const stderr =
        typeof e.stderr === "string"
          ? e.stderr
          : Buffer.isBuffer(e.stderr)
            ? e.stderr.toString("utf-8")
            : e.message ?? String(err);
      throw new Error(
        `devicectl ${args.join(" ")} failed${e.status != null ? ` (exit ${e.status})` : ""}: ${stderr.trim()}`,
      );
    }
    return readFileSync(jsonPath, "utf-8");
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

/** Convenience: list devices via JSON output. */
export function listDevicectlDevices(opts?: {
  execFileSync?: ExecFileSyncFn;
}): DevicectlDevice[] {
  const raw = runDevicectl(["list", "devices"], opts);
  return parseDevicectlListDevicesJson(raw);
}
