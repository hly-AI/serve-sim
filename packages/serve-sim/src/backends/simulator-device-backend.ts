import { execSync as nodeExecSync } from "child_process";
import type {
  BackendCapabilities,
  DeviceBackend,
  HardwareButton,
  ListedDevice,
  GesturePointEvent,
} from "serve-runtime";

type ExecSyncFn = (
  command: string,
  options?: { encoding?: BufferEncoding },
) => string | Buffer;

export function createSimulatorDeviceBackend(deps?: {
  execSync?: ExecSyncFn;
}): DeviceBackend {
  const exec = deps?.execSync ?? nodeExecSync;

  const caps: BackendCapabilities = {
    stream: true,
    tap: true,
    gesture: true,
    button: true,
    screenshot: true,
    installApp: true,
    launchApp: true,
    touchRequiresAgent: false,
  };

  function notWired(method: string): never {
    throw new Error(
      `SimulatorDeviceBackend: ${method} not wired in Plan 1 — use existing serve-sim CLI paths`,
    );
  }

  async function listDevices(): Promise<ListedDevice[]> {
    const output = String(
      exec("xcrun simctl list devices -j", { encoding: "utf-8" }),
    );
    const data = JSON.parse(output) as {
      devices: Record<
        string,
        Array<{ udid: string; name: string; state: string }>
      >;
    };
    const listed: ListedDevice[] = [];
    for (const [runtime, devices] of Object.entries(data.devices)) {
      // Simulators ignore transport; v1 enum only has usb|wifi — use usb.
      if (!/iOS/i.test(runtime)) continue;
      for (const device of devices) {
        listed.push({
          udid: device.udid,
          name: device.name,
          platform: "ios",
          transport: "usb",
          available: device.state === "Booted",
        });
      }
    }
    return listed;
  }

  return {
    kind: "simulator",
    capabilities: () => caps,
    listDevices,
    async resolveDevice(nameOrUdid: string): Promise<string> {
      if (
        /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(
          nameOrUdid,
        )
      ) {
        return nameOrUdid;
      }
      const devices = await listDevices();
      const hit = devices.find(
        (d) => d.name.toLowerCase() === nameOrUdid.toLowerCase(),
      );
      if (!hit) throw new Error(`Could not resolve device: ${nameOrUdid}`);
      return hit.udid;
    },
    async screenshot() {
      notWired("screenshot");
    },
    async installApp() {
      notWired("installApp");
    },
    async launchApp() {
      notWired("launchApp");
    },
    async tap(_udid: string, _x: number, _y: number) {
      notWired("tap");
    },
    async gesture(_udid: string, _events: GesturePointEvent[]) {
      notWired("gesture");
    },
    async button(_udid: string, _name: HardwareButton) {
      notWired("button");
    },
  };
}
