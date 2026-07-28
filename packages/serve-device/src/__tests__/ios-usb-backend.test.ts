import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseDevicectlListDevicesJson } from "../backends/devicectl";
import { createIosUsbDeviceBackend } from "../backends/ios-usb-device-backend";

const fixture = parseDevicectlListDevicesJson(
  readFileSync(
    join(import.meta.dir, "../backends/fixtures/devicectl-list.json"),
    "utf-8",
  ),
);

describe("IosUsbDeviceBackend", () => {
  test("listDevices keeps USB physical, drops wifi/sim", async () => {
    const backend = createIosUsbDeviceBackend({
      listDevicesRaw: () => fixture,
    });
    const list = await backend.listDevices();
    expect(list.map((d) => d.name).sort()).toEqual([
      "Evan's iPhone",
      "Paired But Offline",
    ]);
    const wired = list.find((d) => d.name === "Evan's iPhone");
    expect(wired?.available).toBe(true);
    expect(wired?.transport).toBe("usb");
    expect(list.find((d) => d.name === "Paired But Offline")?.available).toBe(
      false,
    );
  });

  test("resolveDevice matches name", async () => {
    const backend = createIosUsbDeviceBackend({
      listDevicesRaw: () => fixture,
    });
    expect(await backend.resolveDevice("evan's iphone")).toBe(
      "00008150-00156C6C3A40C01C",
    );
  });

  test("resolveDevice matches CoreDevice identifier", async () => {
    const backend = createIosUsbDeviceBackend({
      listDevicesRaw: () => fixture,
    });
    expect(
      await backend.resolveDevice("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"),
    ).toBe("00008150-00156C6C3A40C01C");
  });

  test("installApp and launchApp pass verified argv", async () => {
    const calls: string[][] = [];
    const backend = createIosUsbDeviceBackend({
      listDevicesRaw: () => fixture,
      runDevicectl: (args) => {
        calls.push(args);
        return "{}";
      },
    });
    await backend.installApp("00008150-00156C6C3A40C01C", "/tmp/App.app");
    await backend.launchApp("00008150-00156C6C3A40C01C", "com.example.app");
    expect(calls[0]).toEqual([
      "device",
      "install",
      "app",
      "--device",
      "00008150-00156C6C3A40C01C",
      "/tmp/App.app",
    ]);
    expect(calls[1]).toEqual([
      "device",
      "process",
      "launch",
      "--device",
      "00008150-00156C6C3A40C01C",
      "com.example.app",
    ]);
  });

  test("tap throws WDA message when agent unreachable", async () => {
    const backend = createIosUsbDeviceBackend({
      listDevicesRaw: () => fixture,
      wda: {
        async status() {
          return { ready: false, detail: "down" };
        },
        async ensureSession() {
          throw new Error("no");
        },
        async getWindowSize() {
          return { width: 1, height: 1 };
        },
        async tap() {},
        async pressButton() {},
        async performGesture() {},
      } as any,
    });
    await expect(backend.tap("u", 0.5, 0.5)).rejects.toThrow(/WebDriverAgent/);
  });

  test("tap delegates to WDA when ready", async () => {
    const taps: Array<{ x: number; y: number }> = [];
    const backend = createIosUsbDeviceBackend({
      listDevicesRaw: () => fixture,
      wda: {
        async status() {
          return { ready: true, detail: "ok" };
        },
        async ensureSession() {
          return "S";
        },
        async getWindowSize() {
          return { width: 390, height: 844 };
        },
        async tap(x: number, y: number) {
          taps.push({ x, y });
        },
        async pressButton() {},
        async performGesture() {},
      } as any,
    });
    await backend.tap("u", 0.5, 0.9);
    expect(taps).toEqual([{ x: 0.5, y: 0.9 }]);
  });

  test("screenshot uses injectable buffer source", async () => {
    const backend = createIosUsbDeviceBackend({
      listDevicesRaw: () => fixture,
      screenshotToBuffer: async () => Buffer.from("png-bytes"),
    });
    const shot = await backend.screenshot("00008150-00156C6C3A40C01C");
    expect(shot.contentType).toBe("image/png");
    expect(shot.bytes.toString()).toBe("png-bytes");
  });
});

const udid = process.env.SERVE_DEVICE_USB_UDID;
const describeUsb = udid ? describe : describe.skip;

describeUsb("usb integration", () => {
  test("listDevices includes env udid", async () => {
    const b = createIosUsbDeviceBackend();
    const list = await b.listDevices();
    expect(list.some((d) => d.udid === udid)).toBe(true);
  });
});
