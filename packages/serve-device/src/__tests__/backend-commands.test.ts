import { describe, expect, test } from "bun:test";
import type {
  BackendCapabilities,
  DeviceBackend,
  GesturePointEvent,
  ListedDevice,
} from "serve-runtime";
import {
  parseGestureJson,
  parseHardwareButton,
  resolveTargetUdid,
  runGesture,
  runTap,
} from "../cli/backend-commands";

function mockBackend(opts: {
  devices?: ListedDevice[];
  onTap?: (udid: string, x: number, y: number) => void;
  onGesture?: (udid: string, events: GesturePointEvent[]) => void;
}): DeviceBackend {
  const devices = opts.devices ?? [];
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
      return { bytes: Buffer.from("x"), contentType: "image/png" };
    },
    async installApp() {},
    async launchApp() {},
    async tap(udid, x, y) {
      opts.onTap?.(udid, x, y);
    },
    async gesture(udid, events) {
      opts.onGesture?.(udid, events);
    },
    async button() {},
  };
}

describe("backend-commands", () => {
  test("parseGestureJson accepts event array", () => {
    const events = parseGestureJson(
      JSON.stringify([{ type: "begin", x: 0.1, y: 0.2 }]),
    );
    expect(events).toEqual([{ type: "begin", x: 0.1, y: 0.2 }]);
  });

  test("parseGestureJson rejects non-array", () => {
    expect(() => parseGestureJson("{}")).toThrow(/must be an array/);
  });

  test("parseHardwareButton rejects unknown", () => {
    expect(() => parseHardwareButton("volume")).toThrow(/Unknown button/);
    expect(parseHardwareButton("home")).toBe("home");
  });

  test("resolveTargetUdid uses -d name", async () => {
    const backend = mockBackend({
      devices: [
        {
          udid: "U1",
          name: "Phone",
          platform: "ios",
          transport: "usb",
          available: true,
        },
      ],
    });
    expect(await resolveTargetUdid(backend, "phone")).toBe("U1");
  });

  test("runTap records normalized coords on injectable backend", async () => {
    const calls: Array<{ udid: string; x: number; y: number }> = [];
    const backend = mockBackend({
      devices: [
        {
          udid: "U1",
          name: "Phone",
          platform: "ios",
          transport: "usb",
          available: true,
        },
      ],
      onTap: (udid, x, y) => calls.push({ udid, x, y }),
    });
    await runTap("0.5", "0.9", "Phone", { backend });
    expect(calls).toEqual([{ udid: "U1", x: 0.5, y: 0.9 }]);
  });

  test("runGesture forwards parsed events", async () => {
    const calls: GesturePointEvent[][] = [];
    const backend = mockBackend({
      devices: [
        {
          udid: "U1",
          name: "Phone",
          platform: "ios",
          transport: "usb",
          available: true,
        },
      ],
      onGesture: (_u, events) => calls.push(events),
    });
    await runGesture(
      JSON.stringify([
        { type: "begin", x: 0.2, y: 0.3 },
        { type: "end", x: 0.2, y: 0.8 },
      ]),
      "U1",
      { backend },
    );
    expect(calls[0]).toHaveLength(2);
  });
});
