import { readFileSync, unlinkSync } from "fs";
import {
  listStateFiles,
  stateFileForDevice,
  type ServeDeviceState,
} from "../state";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readStateFile(file: string): ServeDeviceState | null {
  try {
    const state = JSON.parse(readFileSync(file, "utf-8")) as ServeDeviceState;
    if (!state.pid || !isProcessAlive(state.pid)) {
      try {
        unlinkSync(file);
      } catch {}
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/** List running serve-device servers from the device-only state directory. */
export function listStreams(): ServeDeviceState[] {
  const states: ServeDeviceState[] = [];
  for (const file of listStateFiles()) {
    const state = readStateFile(file);
    if (state) states.push(state);
  }
  return states;
}

/** Stop processes recorded in serve-device state files and delete those files. */
export function killStreams(): void {
  for (const file of listStateFiles()) {
    const state = readStateFile(file);
    if (!state) continue;
    try {
      process.kill(state.pid, "SIGTERM");
    } catch {}
    try {
      unlinkSync(stateFileForDevice(state.device));
    } catch {}
  }
}
