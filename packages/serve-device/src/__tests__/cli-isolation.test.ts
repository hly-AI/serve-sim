import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { SERVE_SIM_PRODUCT, stateDirFor, stateFileForDevice as runtimeStateFile } from "serve-runtime";
import {
  inProcessServeDeviceState,
  listStateFiles,
  STATE_DIR,
  writeServeDeviceState,
} from "../state";
import { listStreams } from "../cli/list-kill";

const UDID = "TEST-DEVICE-ISOLATION-UDID";

describe("cli list isolation", () => {
  const simDir = stateDirFor(SERVE_SIM_PRODUCT);
  const simFile = runtimeStateFile(SERVE_SIM_PRODUCT, UDID);
  const deviceFile = join(STATE_DIR, `server-${UDID}.json`);

  beforeEach(() => {
    mkdirSync(STATE_DIR, { recursive: true });
    mkdirSync(simDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(deviceFile);
    } catch {}
    try {
      rmSync(simFile);
    } catch {}
  });

  test("listStreams returns device state and ignores same UDID under serve-sim", () => {
    writeServeDeviceState(inProcessServeDeviceState(UDID, 4200));
    writeFileSync(
      simFile,
      JSON.stringify({
        pid: process.pid,
        port: 3200,
        device: UDID,
        url: "http://127.0.0.1:3200",
        streamUrl: "http://127.0.0.1:3200/helper/x/stream.mjpeg",
        wsUrl: "ws://127.0.0.1:3200/helper/x/ws",
      }),
    );

    const listed = listStreams();
    expect(listed.length).toBe(1);
    expect(listed[0]!.device).toBe(UDID);
    expect(listed[0]!.port).toBe(4200);
    expect(listStateFiles().some((f) => f.includes(UDID))).toBe(true);
    // sim file exists but is not returned by device listStreams
    expect(listed.every((s) => s.port === 4200)).toBe(true);
  });
});
