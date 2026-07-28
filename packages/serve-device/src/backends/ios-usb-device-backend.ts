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
import { captureDeviceScreenshot } from "./screenshot-capture";
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

  async function listRawUsbDevices(): Promise<DevicectlDevice[]> {
    const raw = deps?.listDevicesRaw
      ? deps.listDevicesRaw()
      : listDevicectlDevices();
    return raw.filter((d) => {
      if (d.reality != null && d.reality !== "physical") return false;
      if (d.platform != null && !/^iOS$/i.test(d.platform)) return false;
      if (isNetworkTransport(d.connectionProperties?.transportType))
        return false;
      return true;
    });
  }

  async function listDevices(): Promise<ListedDevice[]> {
    const listed: ListedDevice[] = [];
    for (const d of await listRawUsbDevices()) {
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
    const devices = await listRawUsbDevices();
    const needle = nameOrUdid.toLowerCase();
    const hit = devices.find(
      (d) =>
        d.udid === nameOrUdid ||
        d.identifier === nameOrUdid ||
        d.name.toLowerCase() === needle,
    );
    if (!hit) throw new Error(`Could not resolve device: ${nameOrUdid}`);
    return hit.udid;
  }

  async function defaultScreenshot(udid: string): Promise<Buffer> {
    return captureDeviceScreenshot(udid, {
      runDevicectl: run,
    });
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
      // Injected buffers may be PNG; native path prefers JPEG for MJPEG.
      const contentType =
        bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : "image/png";
      return { bytes, contentType };
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
