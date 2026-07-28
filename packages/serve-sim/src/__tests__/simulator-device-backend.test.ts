import { describe, expect, test } from "bun:test";
import { createSimulatorDeviceBackend } from "../backends/simulator-device-backend";

const FIXTURE = JSON.stringify({
  devices: {
    "com.apple.CoreSimulator.SimRuntime.iOS-18-0": [
      {
        udid: "AAAA-1111-2222-3333-444444444444",
        name: "iPhone 16",
        state: "Booted",
      },
      {
        udid: "BBBB-1111-2222-3333-444444444444",
        name: "iPhone 15",
        state: "Shutdown",
      },
    ],
    "com.apple.CoreSimulator.SimRuntime.watchOS-11-0": [
      {
        udid: "CCCC-1111-2222-3333-444444444444",
        name: "Apple Watch",
        state: "Booted",
      },
    ],
  },
});

describe("SimulatorDeviceBackend", () => {
  test("listDevices returns iOS sims with available from Booted state", async () => {
    const backend = createSimulatorDeviceBackend({
      execSync: () => FIXTURE,
    });
    const list = await backend.listDevices();
    expect(list).toEqual([
      {
        udid: "AAAA-1111-2222-3333-444444444444",
        name: "iPhone 16",
        platform: "ios",
        transport: "usb",
        available: true,
      },
      {
        udid: "BBBB-1111-2222-3333-444444444444",
        name: "iPhone 15",
        platform: "ios",
        transport: "usb",
        available: false,
      },
    ]);
    expect(list.some((d) => d.name === "Apple Watch")).toBe(false);
  });

  test("resolveDevice matches by name case-insensitively", async () => {
    const backend = createSimulatorDeviceBackend({
      execSync: () => FIXTURE,
    });
    expect(await backend.resolveDevice("iphone 16")).toBe(
      "AAAA-1111-2222-3333-444444444444",
    );
  });

  test("capabilities report touchRequiresAgent false", () => {
    const backend = createSimulatorDeviceBackend({
      execSync: () => FIXTURE,
    });
    expect(backend.kind).toBe("simulator");
    expect(backend.capabilities()).toEqual({
      stream: true,
      tap: true,
      gesture: true,
      button: true,
      screenshot: true,
      installApp: true,
      launchApp: true,
      touchRequiresAgent: false,
    });
  });

  test("tap throws Plan-1 not-wired error", async () => {
    const backend = createSimulatorDeviceBackend({
      execSync: () => FIXTURE,
    });
    await expect(backend.tap("AAAA-1111-2222-3333-444444444444", 0.5, 0.5)).rejects.toThrow(
      /not wired in Plan 1/,
    );
  });
});
