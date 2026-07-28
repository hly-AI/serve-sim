import { describe, expect, test } from "bun:test";
import { createStubIosDeviceBackend } from "../backends/stub-ios-device-backend";

const STUB_ERR =
  "serve-device: iOS USB backend not implemented yet (Plan 3). Touch/WDA lands in Plan 4.";

describe("StubIosDeviceBackend", () => {
  test("kind is device and touchRequiresAgent is true", () => {
    const backend = createStubIosDeviceBackend();
    expect(backend.kind).toBe("device");
    expect(backend.capabilities().touchRequiresAgent).toBe(true);
    expect(backend.capabilities().stream).toBe(true);
    expect(backend.capabilities().tap).toBe(true);
  });

  test("listDevices returns empty", async () => {
    expect(await createStubIosDeviceBackend().listDevices()).toEqual([]);
  });

  test("resolveDevice throws Could not resolve device", async () => {
    await expect(
      createStubIosDeviceBackend().resolveDevice("iphone"),
    ).rejects.toThrow(/Could not resolve device/);
  });

  test("mutating methods throw Plan 3/4 message", async () => {
    const b = createStubIosDeviceBackend();
    await expect(b.tap("u", 0.5, 0.5)).rejects.toThrow(STUB_ERR);
    await expect(b.gesture("u", [])).rejects.toThrow(STUB_ERR);
    await expect(b.button("u", "home")).rejects.toThrow(STUB_ERR);
    await expect(b.screenshot("u")).rejects.toThrow(STUB_ERR);
    await expect(b.installApp("u", "/app.app")).rejects.toThrow(STUB_ERR);
    await expect(b.launchApp("u", "com.example")).rejects.toThrow(STUB_ERR);
  });
});
