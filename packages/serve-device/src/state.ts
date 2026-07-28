import {
  SERVE_DEVICE_PRODUCT,
  inProcessDeviceServerState,
  listStateFiles as listStateFilesFor,
  stateDirFor,
  stateFileForDevice as stateFileForDeviceFor,
  writeDeviceServerState,
  type DeviceServerState,
} from "serve-runtime";

export const STATE_DIR = stateDirFor(SERVE_DEVICE_PRODUCT);
export type ServeDeviceState = DeviceServerState;

export function stateFileForDevice(udid: string): string {
  return stateFileForDeviceFor(SERVE_DEVICE_PRODUCT, udid);
}

export function listStateFiles(): string[] {
  return listStateFilesFor(SERVE_DEVICE_PRODUCT);
}

export function writeServeDeviceState(state: ServeDeviceState): void {
  writeDeviceServerState(SERVE_DEVICE_PRODUCT, state);
}

export function inProcessServeDeviceState(
  udid: string,
  port: number,
  base = "/",
  host = "127.0.0.1",
): ServeDeviceState {
  return inProcessDeviceServerState(
    SERVE_DEVICE_PRODUCT,
    udid,
    port,
    base,
    host,
  );
}
