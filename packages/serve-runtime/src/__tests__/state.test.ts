import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  SERVE_DEVICE_PRODUCT,
  SERVE_SIM_PRODUCT,
} from "../product-identity";
import {
  inProcessDeviceServerState,
  listStateFiles,
  stateDirFor,
  stateFileForDevice,
  writeDeviceServerState,
} from "../state";

describe("parameterized state", () => {
  const simDir = stateDirFor(SERVE_SIM_PRODUCT);
  const deviceDir = stateDirFor(SERVE_DEVICE_PRODUCT);
  const udid = "TEST-RUNTIME-UDID-1111";

  beforeEach(() => {
    mkdirSync(simDir, { recursive: true });
    mkdirSync(deviceDir, { recursive: true });
  });

  afterEach(() => {
    for (const dir of [simDir, deviceDir]) {
      try {
        rmSync(join(dir, `server-${udid}.json`));
      } catch {}
    }
  });

  test("sim and device state dirs are distinct under tmpdir", () => {
    expect(simDir).toBe(join(tmpdir(), "serve-sim"));
    expect(deviceDir).toBe(join(tmpdir(), "serve-device"));
    expect(simDir).not.toBe(deviceDir);
  });

  test("writing device state does not appear in sim listStateFiles", () => {
    writeDeviceServerState(
      SERVE_DEVICE_PRODUCT,
      inProcessDeviceServerState(SERVE_DEVICE_PRODUCT, udid, 4200),
    );
    const simFiles = listStateFiles(SERVE_SIM_PRODUCT).filter((f) =>
      f.includes(udid),
    );
    const deviceFiles = listStateFiles(SERVE_DEVICE_PRODUCT).filter((f) =>
      f.includes(udid),
    );
    expect(deviceFiles.length).toBe(1);
    expect(simFiles.length).toBe(0);
    expect(existsSync(stateFileForDevice(SERVE_DEVICE_PRODUCT, udid))).toBe(
      true,
    );
  });
});
