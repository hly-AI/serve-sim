import { join } from "path";
import { SERVE_SIM_PRODUCT } from "serve-runtime";
import {
  inProcessDeviceServerState,
  listStateFiles as listStateFilesFor,
  stateDirFor,
  stateFileForDevice as stateFileForDeviceFor,
  writeDeviceServerState,
  type DeviceServerState,
} from "serve-runtime";

/** Directory where serve-sim stores runtime state. */
export const STATE_DIR = stateDirFor(SERVE_SIM_PRODUCT);

/** Path to the serve-sim server state file (JSON with pid, port, URLs).
 *  @deprecated Use `stateFileForDevice(udid)` for multi-device support. Kept for backward compat. */
export const STATE_FILE = join(STATE_DIR, "server.json");

/** Per-device state file: `/tmp/serve-sim/server-{udid}.json` */
export function stateFileForDevice(udid: string): string {
  return stateFileForDeviceFor(SERVE_SIM_PRODUCT, udid);
}

/** Runtime record for a device streamed in-process by a preview server. */
export type ServeSimDeviceState = DeviceServerState;

/**
 * Build the state for a device served in-process. There's no separate helper
 * port — the URLs point at the preview server's own same-origin
 * `{base}/helper/<device>/…` routes, which simMiddleware serves from a
 * NativeCapture/NativeHid DeviceSession.
 */
export function inProcessServeSimState(
  udid: string,
  port: number,
  base = "/",
  host = "127.0.0.1",
): ServeSimDeviceState {
  return inProcessDeviceServerState(SERVE_SIM_PRODUCT, udid, port, base, host);
}

/** Persist a device's state so other processes / the grid can enumerate it.
 *  Writes atomically (temp file + rename) so a concurrent reader never observes
 *  a truncated or partially-written file. */
export function writeServeSimState(state: ServeSimDeviceState): void {
  writeDeviceServerState(SERVE_SIM_PRODUCT, state);
}

/** List all per-device state files in the state directory. */
export function listStateFiles(): string[] {
  return listStateFilesFor(SERVE_SIM_PRODUCT);
}
