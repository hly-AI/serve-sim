import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  captureDeviceScreenshot,
  resolvePmd3Bin,
} from "../backends/screenshot-capture";

describe("resolvePmd3Bin", () => {
  test("prefers SERVE_DEVICE_PMD3 / preferred path when present", () => {
    const bin = resolvePmd3Bin({
      preferred: "/cache/pmd3",
      existsSync: (p) => p === "/cache/pmd3",
      which: () => "/usr/bin/pymobiledevice3",
    });
    expect(bin).toBe("/cache/pmd3");
  });

  test("falls back to which(pymobiledevice3)", () => {
    const bin = resolvePmd3Bin({
      preferred: "/missing",
      existsSync: () => false,
      which: () => "/opt/bin/pymobiledevice3",
    });
    expect(bin).toBe("/opt/bin/pymobiledevice3");
  });
});

describe("captureDeviceScreenshot", () => {
  test("uses pymobiledevice3 when Apple tools fail", () => {
    const dir = mkdtempSync(join(tmpdir(), "shot-test-"));
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const calls: string[] = [];

    const bytes = captureDeviceScreenshot("UDID", {
      mkTempDir: () => dir,
      runDevicectl: () => {
        throw new Error("no capture");
      },
      pmd3Bin: "/fake/pmd3",
      execFileSync: (file, args) => {
        calls.push(`${file} ${args.join(" ")}`);
        if (String(file) === "idevicescreenshot") {
          throw new Error("no screenshotr");
        }
        if (String(file) === "/fake/pmd3") {
          const out = String(args[args.length - 1]);
          writeFileSync(out, jpegMagic);
          return "";
        }
        if (String(file) === "sips") {
          const out = String(args[args.length - 1]);
          writeFileSync(out, jpegMagic);
          return "";
        }
        return "";
      },
    });

    expect(bytes[0]).toBe(0xff);
    expect(calls.some((c) => c.includes("developer dvt screenshot"))).toBe(
      true,
    );
    expect(calls.some((c) => c.includes("--userspace"))).toBe(true);
    expect(calls.some((c) => c.includes("--udid UDID"))).toBe(true);
  });
});
