import type {
  BackendCapabilities,
  DeviceBackend,
  GesturePointEvent,
  HardwareButton,
} from "serve-runtime";

const STUB_ERR =
  "serve-device: iOS USB backend not implemented yet (Plan 3). Touch/WDA lands in Plan 4.";

export function createStubIosDeviceBackend(): DeviceBackend {
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

  function notReady(): never {
    throw new Error(STUB_ERR);
  }

  return {
    kind: "device",
    capabilities: () => caps,
    async listDevices() {
      return [];
    },
    async resolveDevice(nameOrUdid: string): Promise<string> {
      throw new Error(`Could not resolve device: ${nameOrUdid}`);
    },
    async screenshot() {
      notReady();
    },
    async installApp() {
      notReady();
    },
    async launchApp() {
      notReady();
    },
    async tap(_udid: string, _x: number, _y: number) {
      notReady();
    },
    async gesture(_udid: string, _events: GesturePointEvent[]) {
      notReady();
    },
    async button(_udid: string, _name: HardwareButton) {
      notReady();
    },
  };
}
