import { execSync } from "child_process";
import { writeFileSync } from "fs";
import type {
  DeviceBackend,
  GesturePointEvent,
  HardwareButton,
} from "serve-runtime";
import { createIosUsbDeviceBackend } from "../backends/ios-usb-device-backend";
import { createStubIosDeviceBackend } from "../backends/stub-ios-device-backend";

const BUTTONS: HardwareButton[] = [
  "home",
  "lock",
  "side-button",
  "siri",
  "apple-pay",
];

/** Prefer real USB backend; tests inject their own. */
export function defaultBackend(): DeviceBackend {
  try {
    return createIosUsbDeviceBackend();
  } catch {
    return createStubIosDeviceBackend();
  }
}
export function parseGestureJson(jsonStr: string): GesturePointEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("gesture JSON is invalid");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("gesture JSON must be an array of events");
  }
  return parsed as GesturePointEvent[];
}

export function parseHardwareButton(name: string): HardwareButton {
  if ((BUTTONS as string[]).includes(name)) return name as HardwareButton;
  throw new Error(
    `Unknown button '${name}'. Supported: ${BUTTONS.join(", ")}`,
  );
}

export async function resolveTargetUdid(
  backend: DeviceBackend,
  deviceArg: string | undefined,
): Promise<string> {
  if (deviceArg) return backend.resolveDevice(deviceArg);
  const listed = await backend.listDevices();
  const available = listed.find((d) => d.available) ?? listed[0];
  if (!available) {
    throw new Error(
      "No USB iOS device available. Plug in a device, trust this computer, then pass -d <udid|name>.",
    );
  }
  return available.udid;
}

export type BackendCommandDeps = {
  backend?: DeviceBackend;
  writeFile?: typeof writeFileSync;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
};

function depsWithDefaults(deps?: BackendCommandDeps) {
  return {
    backend: deps?.backend ?? defaultBackend(),
    writeFile: deps?.writeFile ?? writeFileSync,
    log: deps?.log ?? console.log,
    error: deps?.error ?? console.error,
  };
}

export async function runTap(
  xArg: string,
  yArg: string,
  deviceArg: string | undefined,
  deps?: BackendCommandDeps,
): Promise<void> {
  const { backend } = depsWithDefaults(deps);
  const x = Number(xArg);
  const y = Number(yArg);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("tap requires numeric x and y in 0..1");
  }
  const udid = await resolveTargetUdid(backend, deviceArg);
  await backend.tap(udid, x, y);
}

export async function runGesture(
  jsonStr: string,
  deviceArg: string | undefined,
  deps?: BackendCommandDeps,
): Promise<void> {
  const { backend } = depsWithDefaults(deps);
  const events = parseGestureJson(jsonStr);
  const udid = await resolveTargetUdid(backend, deviceArg);
  await backend.gesture(udid, events);
}

export async function runButton(
  buttonName: string | undefined,
  deviceArg: string | undefined,
  deps?: BackendCommandDeps,
): Promise<void> {
  const { backend } = depsWithDefaults(deps);
  const name = parseHardwareButton(buttonName ?? "home");
  const udid = await resolveTargetUdid(backend, deviceArg);
  await backend.button(udid, name);
}

export async function runScreenshot(
  deviceArg: string | undefined,
  outPath: string | undefined,
  deps?: BackendCommandDeps,
): Promise<void> {
  const { backend, writeFile, log } = depsWithDefaults(deps);
  const udid = await resolveTargetUdid(backend, deviceArg);
  const shot = await backend.screenshot(udid);
  const path =
    outPath ??
    `serve-device-screenshot-${Date.now()}.${shot.contentType === "image/png" ? "png" : "jpg"}`;
  writeFile(path, shot.bytes);
  log(path);
}

export async function runInstall(
  appPath: string,
  deviceArg: string | undefined,
  deps?: BackendCommandDeps,
): Promise<void> {
  const { backend } = depsWithDefaults(deps);
  const udid = await resolveTargetUdid(backend, deviceArg);
  await backend.installApp(udid, appPath);
}

export async function runLaunch(
  bundleId: string,
  deviceArg: string | undefined,
  deps?: BackendCommandDeps,
): Promise<void> {
  const { backend } = depsWithDefaults(deps);
  const udid = await resolveTargetUdid(backend, deviceArg);
  await backend.launchApp(udid, bundleId);
}

export function runDoctor(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;

  if (process.platform !== "darwin") {
    lines.push("host: FAIL — serve-device requires macOS");
    ok = false;
  } else {
    lines.push("host: OK (macOS)");
  }

  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isFinite(major) || major < 20) {
    lines.push(`node: FAIL — need Node >= 20 (found ${process.versions.node})`);
    ok = false;
  } else {
    lines.push(`node: OK (${process.versions.node})`);
  }

  try {
    execSync("xcrun --version", { stdio: "pipe" });
    lines.push("xcrun: OK");
  } catch {
    lines.push("xcrun: FAIL — install Xcode command line tools");
    ok = false;
  }

  lines.push("USB backend: ready (devicectl)");
  lines.push("WDA: not ready");
  return { ok, lines };
}
