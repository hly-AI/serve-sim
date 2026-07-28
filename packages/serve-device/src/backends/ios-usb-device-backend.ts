import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type {
  BackendCapabilities,
  DeviceBackend,
  GesturePointEvent,
  HardwareButton,
  ListedDevice,
  ScreenshotResult,
} from "serve-runtime";
import {
  isNetworkTransport,
  isTunnelConnected,
  listDevicectlDevices,
  runDevicectl,
  type DevicectlDevice,
} from "./devicectl";

const WDA_ERR =
  "Touch requires WebDriverAgent. Run `serve-device setup -d <udid>` then `serve-device doctor`.";

type RunDevicectl = typeof runDevicectl;

export function createIosUsbDeviceBackend(deps?: {
  runDevicectl?: RunDevicectl;
  listDevicesRaw?: () => DevicectlDevice[];
  screenshotToBuffer?: (udid: string) => Promise<Buffer>;
}): DeviceBackend {
  const run = deps?.runDevicectl ?? runDevicectl;

  const caps: BackendCapabilities = {
    stream: true,
    tap: true,
    gesture: true,
    button: true,
    screenshot: true,
    installApp: true,
    launchApp: true,
    touchRequiresAgent: true,
  };

  async function listDevices(): Promise<ListedDevice[]> {
    const raw = deps?.listDevicesRaw
      ? deps.listDevicesRaw()
      : listDevicectlDevices();
    const listed: ListedDevice[] = [];
    for (const d of raw) {
      if (d.reality != null && d.reality !== "physical") continue;
      if (d.platform != null && !/^iOS$/i.test(d.platform)) continue;
      if (isNetworkTransport(d.connectionProperties?.transportType)) continue;
      listed.push({
        udid: d.udid,
        name: d.name,
        platform: "ios",
        transport: "usb",
        available: isTunnelConnected(d.connectionProperties?.tunnelState),
      });
    }
    return listed;
  }

  async function resolveDevice(nameOrUdid: string): Promise<string> {
    const devices = await listDevices();
    const hit = devices.find(
      (d) =>
        d.udid === nameOrUdid ||
        d.name.toLowerCase() === nameOrUdid.toLowerCase(),
    );
    if (!hit) throw new Error(`Could not resolve device: ${nameOrUdid}`);
    return hit.udid;
  }

  async function defaultScreenshot(udid: string): Promise<Buffer> {
    // Verified argv (Xcode CoreDevice):
    //   xcrun devicectl device capture screenshot --device <udid> --destination <path.png>
    const dir = mkdtempSync(join(tmpdir(), "serve-device-shot-"));
    const dest = join(dir, "shot.png");
    try {
      run([
        "device",
        "capture",
        "screenshot",
        "--device",
        udid,
        "--destination",
        dest,
      ]);
      return readFileSync(dest);
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  }

  return {
    kind: "device",
    capabilities: () => caps,
    listDevices,
    resolveDevice,
    async screenshot(udid: string): Promise<ScreenshotResult> {
      const bytes = deps?.screenshotToBuffer
        ? await deps.screenshotToBuffer(udid)
        : await defaultScreenshot(udid);
      return { bytes, contentType: "image/png" };
    },
    async installApp(udid: string, appPath: string): Promise<void> {
      // Verified: xcrun devicectl device install app --device <udid> <path>
      run(["device", "install", "app", "--device", udid, appPath]);
    },
    async launchApp(udid: string, bundleId: string): Promise<void> {
      // Verified: xcrun devicectl device process launch --device <udid> <bundleId>
      run(["device", "process", "launch", "--device", udid, bundleId]);
    },
    async tap(_udid: string, _x: number, _y: number): Promise<void> {
      throw new Error(WDA_ERR);
    },
    async gesture(
      _udid: string,
      _events: GesturePointEvent[],
    ): Promise<void> {
      throw new Error(WDA_ERR);
    },
    async button(_udid: string, _name: HardwareButton): Promise<void> {
      throw new Error(WDA_ERR);
    },
  };
}
