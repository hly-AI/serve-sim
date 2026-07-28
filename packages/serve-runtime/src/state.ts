import { tmpdir } from "os";
import { join } from "path";
import { readdirSync, mkdirSync, writeFileSync, renameSync } from "fs";
import type { ProductIdentity } from "./product-identity";

/** Runtime record for a device streamed in-process by a preview server. */
export interface DeviceServerState {
  pid: number;
  port: number;
  device: string;
  url: string;
  streamUrl: string;
  wsUrl: string;
}

export function stateDirFor(product: ProductIdentity): string {
  return join(tmpdir(), product.stateDirName);
}

/** Per-device state file: `$TMPDIR/<product>/server-{udid}.json` */
export function stateFileForDevice(
  product: ProductIdentity,
  udid: string,
): string {
  return join(stateDirFor(product), `server-${udid}.json`);
}

/**
 * Build the state for a device served in-process. URLs point at the preview
 * server's same-origin `{base}/helper/<device>/…` routes.
 */
export function inProcessDeviceServerState(
  product: ProductIdentity,
  udid: string,
  port: number,
  base = "/",
  host = "127.0.0.1",
): DeviceServerState {
  void product;
  const h = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  const trimmed = base.replace(/^\/+/, "").replace(/\/+$/, "");
  const prefix = trimmed === "" ? "" : `/${trimmed}`;
  return {
    pid: process.pid,
    port,
    device: udid,
    url: `http://${h}:${port}`,
    streamUrl: `http://${h}:${port}${prefix}/helper/${udid}/stream.mjpeg`,
    wsUrl: `ws://${h}:${port}${prefix}/helper/${udid}/ws`,
  };
}

/** Persist a device's state atomically (temp file + rename). */
export function writeDeviceServerState(
  product: ProductIdentity,
  state: DeviceServerState,
): void {
  const dir = stateDirFor(product);
  mkdirSync(dir, { recursive: true });
  const file = stateFileForDevice(product, state.device);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, file);
}

/** List all per-device state files in the product's state directory. */
export function listStateFiles(product: ProductIdentity): string[] {
  try {
    return readdirSync(stateDirFor(product))
      .filter((f) => f.startsWith("server-") && f.endsWith(".json"))
      .map((f) => join(stateDirFor(product), f));
  } catch {
    return [];
  }
}
