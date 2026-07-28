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
import { WdaClient } from "../wda/wda-client";

const WDA_ERR =
  "Touch requires WebDriverAgent. Run `serve-device setup -d <udid>` then `serve-device doctor`.";

type RunDevicectl = typeof runDevicectl;
type WdaProvider = WdaClient | (() => Promise<WdaClient | null> | WdaClient | null);

export function createIosUsbDeviceBackend(deps?: {
  runDevicectl?: RunDevicectl;
  listDevicesRaw?: () => DevicectlDevice[];
  screenshotToBuffer?: (udid: string) => Promise<Buffer>;
  wda?: WdaProvider;
  /** Default WDA base URL when constructing a client automatically. */
  wdaBaseUrl?: string;
}): DeviceBackend {
  const run = deps?.runDevicectl ?? runDevicectl;
  const wdaBaseUrl =
    deps?.wdaBaseUrl ??
    process.env.SERVE_DEVICE_WDA_URL ??
    "http://127.0.0.1:8100";

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

  async function resolveWda(): Promise<WdaClient | null> {
    if (deps?.wda) {
      return typeof deps.wda === "function" ? await deps.wda() : deps.wda;
    }
    return new WdaClient({ baseUrl: wdaBaseUrl });
  }

  async function requireWda(): Promise<WdaClient> {
    const client = await resolveWda();
    if (!client) throw new Error(WDA_ERR);
    const st = await client.status();
    if (!st.ready) throw new Error(WDA_ERR);
    return client;
  }

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
      run(["device", "install", "app", "--device", udid, appPath]);
    },
    async launchApp(udid: string, bundleId: string): Promise<void> {
      run(["device", "process", "launch", "--device", udid, bundleId]);
    },
    async tap(_udid: string, x: number, y: number): Promise<void> {
      const wda = await requireWda();
      await wda.tap(x, y);
    },
    async gesture(
      _udid: string,
      events: GesturePointEvent[],
    ): Promise<void> {
      const wda = await requireWda();
      await wda.performGesture(events);
    },
    async button(_udid: string, name: HardwareButton): Promise<void> {
      const wda = await requireWda();
      await wda.pressButton(name);
    },
  };
}
