import { describe, expect, test } from "bun:test";
import type {
  BackendCapabilities,
  DeviceBackend,
  ListedDevice,
} from "../device-backend";

function fakeBackend(devices: ListedDevice[]): DeviceBackend {
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
  return {
    kind: "device",
    capabilities: () => caps,
    async listDevices() {
      return devices;
    },
    async resolveDevice(nameOrUdid) {
      const hit = devices.find(
        (d) =>
          d.udid === nameOrUdid ||
          d.name.toLowerCase() === nameOrUdid.toLowerCase(),
      );
      if (!hit) throw new Error(`Could not resolve device: ${nameOrUdid}`);
      return hit.udid;
    },
    async screenshot() {
      return { bytes: Buffer.from("png"), contentType: "image/png" };
    },
    async installApp() {},
    async launchApp() {},
    async tap() {},
    async gesture() {},
    async button() {},
  };
}

describe("DeviceBackend contract", () => {
  test("resolveDevice matches by name case-insensitively", async () => {
    const backend = fakeBackend([
      {
        udid: "UDID-1",
        name: "Evan's iPhone",
        platform: "ios",
        transport: "usb",
        available: true,
      },
    ]);
    expect(await backend.resolveDevice("evan's iphone")).toBe("UDID-1");
    await expect(backend.resolveDevice("missing")).rejects.toThrow(
      /Could not resolve device/,
    );
  });

  test("device backend advertises touchRequiresAgent when set", () => {
    const backend = fakeBackend([]);
    expect(backend.capabilities().touchRequiresAgent).toBe(false);
    expect(backend.kind).toBe("device");
  });
});
