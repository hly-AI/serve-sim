import type { Transport } from "./product-identity";

/** Reserved for Android; v1 only ever returns "ios". */
export type DevicePlatform = "ios" | "android";

export type BackendKind = "simulator" | "device";

export interface ListedDevice {
  udid: string;
  name: string;
  platform: DevicePlatform;
  transport: Transport;
  /** True when the host can currently talk to the device (USB plugged / sim booted). */
  available: boolean;
}

export type HardwareButton =
  | "home"
  | "lock"
  | "side-button"
  | "siri"
  | "apple-pay";

export interface GesturePointEvent {
  type: "begin" | "move" | "end";
  x: number;
  y: number;
  /** Optional delay in ms before sending this event (CLI gesture JSON parity). */
  delay?: number;
}

export interface ScreenshotResult {
  /** PNG or JPEG bytes */
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg";
}

/**
 * Capability flags so CLI/UI can tell protocol-only vs agent-required features.
 * v1 device backend: touch/gesture often need WDA (`touchRequiresAgent: true`).
 */
export interface BackendCapabilities {
  stream: boolean;
  tap: boolean;
  gesture: boolean;
  button: boolean;
  screenshot: boolean;
  installApp: boolean;
  launchApp: boolean;
  /** When true, tap/gesture/button may require on-device agent (WDA). */
  touchRequiresAgent: boolean;
}

export interface DeviceBackend {
  readonly kind: BackendKind;
  capabilities(): BackendCapabilities;

  listDevices(): Promise<ListedDevice[]>;
  /** Resolve name or UDID to UDID; throw Error with clear message if missing. */
  resolveDevice(nameOrUdid: string): Promise<string>;

  screenshot(udid: string): Promise<ScreenshotResult>;
  installApp(udid: string, appPath: string): Promise<void>;
  launchApp(udid: string, bundleId: string): Promise<void>;

  tap(udid: string, x: number, y: number): Promise<void>;
  gesture(udid: string, events: GesturePointEvent[]): Promise<void>;
  button(udid: string, name: HardwareButton): Promise<void>;
}
