import { execFileSync } from "child_process";
import type { DeviceBackend } from "serve-runtime";
import { createIosUsbDeviceBackend } from "../backends/ios-usb-device-backend";
import { resolvePmd3Bin } from "../backends/screenshot-capture";
import { WdaClient } from "../wda/wda-client";

export interface DoctorReport {
  ok: boolean;
  checks: Array<{ id: string; ok: boolean; message: string }>;
}

export type DoctorDeps = {
  platform?: NodeJS.Platform;
  nodeVersion?: string;
  whichXcrun?: () => boolean;
  whichDevicectl?: () => boolean;
  backend?: DeviceBackend;
  wdaBaseUrl?: string;
  fetch?: typeof fetch;
};

function hasBin(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasDevicectl(): boolean {
  try {
    execFileSync("xcrun", ["devicectl", "--help"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export async function runDoctor(
  opts: {
    udid?: string;
    wdaBaseUrl?: string;
  } = {},
  deps: DoctorDeps = {},
): Promise<DoctorReport> {
  const checks: DoctorReport["checks"] = [];
  const platform = deps.platform ?? process.platform;
  const nodeVersion = deps.nodeVersion ?? process.versions.node;
  const wdaBaseUrl =
    opts.wdaBaseUrl ??
    deps.wdaBaseUrl ??
    process.env.SERVE_DEVICE_WDA_URL ??
    "http://127.0.0.1:8100";

  const darwinOk = platform === "darwin";
  checks.push({
    id: "host.darwin",
    ok: darwinOk,
    message: darwinOk
      ? "macOS host"
      : `serve-device requires macOS (found ${platform})`,
  });

  const major = Number(nodeVersion.split(".")[0]);
  const nodeOk = Number.isFinite(major) && major >= 20;
  checks.push({
    id: "host.node",
    ok: nodeOk,
    message: nodeOk
      ? `Node ${nodeVersion}`
      : `Node >= 20 required (found ${nodeVersion})`,
  });

  const xcrunOk = deps.whichXcrun ? deps.whichXcrun() : hasBin("xcrun");
  checks.push({
    id: "host.xcrun",
    ok: xcrunOk,
    message: xcrunOk
      ? "xcrun available"
      : "xcrun not found — install Xcode command line tools",
  });

  const dctOk = deps.whichDevicectl
    ? deps.whichDevicectl()
    : xcrunOk && hasDevicectl();
  checks.push({
    id: "host.devicectl",
    ok: dctOk,
    message: dctOk
      ? "devicectl available"
      : "xcrun devicectl not available — install a recent Xcode",
  });

  const backend = deps.backend ?? createIosUsbDeviceBackend();
  let usbOk = false;
  let usbMsg = "no USB iOS devices found";
  try {
    const listed = await backend.listDevices();
    if (opts.udid) {
      const hit = listed.find(
        (d) =>
          d.udid === opts.udid ||
          d.name.toLowerCase() === opts.udid!.toLowerCase(),
      );
      usbOk = !!hit;
      usbMsg = hit
        ? `device ${hit.udid} (${hit.name})${hit.available ? "" : " — paired but tunnel not connected; plug in USB"}`
        : `requested device not listed: ${opts.udid}`;
    } else {
      usbOk = listed.length > 0;
      usbMsg = usbOk
        ? `${listed.length} physical USB-capable device(s)`
        : "no physical USB iOS devices listed via devicectl";
    }
  } catch (err) {
    usbMsg = err instanceof Error ? err.message : String(err);
  }
  checks.push({ id: "device.usb", ok: usbOk, message: usbMsg });

  const pmd3 = resolvePmd3Bin();
  checks.push({
    id: "screenshot.pmd3",
    ok: !!pmd3,
    message: pmd3
      ? `pymobiledevice3 at ${pmd3} (iOS 17+ screenshot fallback)`
      : "pymobiledevice3 not found — needed on Xcode without `device capture screenshot`. See README Screenshot tools.",
  });

  const wda = new WdaClient({
    baseUrl: wdaBaseUrl,
    fetch: deps.fetch,
  });
  const st = await wda.status();
  checks.push({
    id: "wda.reachable",
    ok: st.ready,
    message: st.ready
      ? `WDA reachable at ${wdaBaseUrl}`
      : `WDA not reachable at ${wdaBaseUrl} (${st.detail}). Run serve-device setup.`,
  });

  // Optional deeper check — only when reachable
  if (st.ready) {
    try {
      await wda.ensureSession();
      checks.push({
        id: "wda.session",
        ok: true,
        message: "WDA session create OK",
      });
    } catch (err) {
      checks.push({
        id: "wda.session",
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    checks.push({
      id: "wda.session",
      ok: false,
      message: "skipped — WDA not reachable",
    });
  }

  // Required checks for overall ok: host + xcrun + devicectl. USB/WDA are
  // reported but WDA failure should fail doctor when touch is expected.
  const required = new Set([
    "host.darwin",
    "host.node",
    "host.xcrun",
    "host.devicectl",
    "device.usb",
    "wda.reachable",
  ]);
  const ok = checks
    .filter((c) => required.has(c.id))
    .every((c) => c.ok);

  return { ok, checks };
}

export function formatDoctorReport(report: DoctorReport): string {
  return report.checks
    .map((c) => `${c.ok ? "OK" : "FAIL"}  ${c.id}: ${c.message}`)
    .join("\n");
}
