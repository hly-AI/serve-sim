import { describe, expect, test } from "bun:test";
import { runDoctor } from "../cli/doctor";
import type { DeviceBackend, ListedDevice } from "serve-runtime";

function fakeBackend(devices: ListedDevice[]): DeviceBackend {
  return {
    kind: "device",
    capabilities: () => ({
      stream: true,
      tap: true,
      gesture: true,
      button: true,
      screenshot: true,
      installApp: true,
      launchApp: true,
      touchRequiresAgent: true,
    }),
    async listDevices() {
      return devices;
    },
    async resolveDevice() {
      return devices[0]!.udid;
    },
    async screenshot() {
      return { bytes: Buffer.from(""), contentType: "image/png" };
    },
    async installApp() {},
    async launchApp() {},
    async tap() {},
    async gesture() {},
    async button() {},
  };
}

describe("runDoctor", () => {
  test("fails when not darwin", async () => {
    const report = await runDoctor(
      {},
      {
        platform: "linux",
        nodeVersion: "22.0.0",
        whichXcrun: () => true,
        whichDevicectl: () => true,
        backend: fakeBackend([]),
        fetch: async () => new Response("", { status: 500 }),
      },
    );
    expect(report.checks.find((c) => c.id === "host.darwin")?.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  test("passes host checks and reports WDA down", async () => {
    const report = await runDoctor(
      {},
      {
        platform: "darwin",
        nodeVersion: "22.0.0",
        whichXcrun: () => true,
        whichDevicectl: () => true,
        backend: fakeBackend([
          {
            udid: "U1",
            name: "Phone",
            platform: "ios",
            transport: "usb",
            available: true,
          },
        ]),
        fetch: async () => {
          throw new Error("ECONNREFUSED");
        },
      },
    );
    expect(report.checks.find((c) => c.id === "host.darwin")?.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "device.usb")?.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "wda.reachable")?.ok).toBe(
      false,
    );
    expect(report.ok).toBe(false);
  });

  test("ok when WDA reachable", async () => {
    const report = await runDoctor(
      {},
      {
        platform: "darwin",
        nodeVersion: "22.0.0",
        whichXcrun: () => true,
        whichDevicectl: () => true,
        backend: fakeBackend([
          {
            udid: "U1",
            name: "Phone",
            platform: "ios",
            transport: "usb",
            available: true,
          },
        ]),
        fetch: async (input, init) => {
          const url = String(input);
          if (url.endsWith("/status")) {
            return new Response("{}", { status: 200 });
          }
          if (url.endsWith("/session") && init?.method === "POST") {
            return new Response(
              JSON.stringify({ value: { sessionId: "S" } }),
              { status: 200 },
            );
          }
          return new Response("{}", { status: 200 });
        },
      },
    );
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "wda.reachable")?.ok).toBe(true);
  });
});
