import type { GesturePointEvent, HardwareButton } from "serve-runtime";
import { collapseGestureEvents } from "./wda-gesture";

export interface WdaClientOptions {
  /** Base URL, e.g. http://127.0.0.1:8100 */
  baseUrl: string;
  fetch?: typeof fetch;
}

type Json = Record<string, unknown>;

function roundPx(n: number): number {
  return Math.round(n);
}

/** Map normalized 0..1 coords to integer pixels (floor of mid via round). */
export function normalizedToPixels(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: roundPx(x * width),
    y: roundPx(y * height),
  };
}

const BUTTON_MAP: Partial<Record<HardwareButton, string>> = {
  home: "home",
};

export class WdaClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private sessionId: string | null = null;
  private windowSize: { width: number; height: number } | null = null;

  constructor(opts: WdaClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchFn = opts.fetch ?? fetch;
  }

  async status(): Promise<{ ready: boolean; detail: string }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/status`);
      if (!res.ok) {
        return { ready: false, detail: `HTTP ${res.status}` };
      }
      return { ready: true, detail: "WDA /status OK" };
    } catch (err) {
      return {
        ready: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async ensureSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    const body = {
      capabilities: {
        alwaysMatch: { platformName: "iOS" },
      },
    };
    const data = await this.postJson("/session", body);
    const value = (data.value ?? data) as Json;
    const id =
      (typeof value.sessionId === "string" && value.sessionId) ||
      (typeof data.sessionId === "string" && data.sessionId) ||
      null;
    if (!id) throw new Error("WDA session create returned no sessionId");
    this.sessionId = id;
    return id;
  }

  async getWindowSize(): Promise<{ width: number; height: number }> {
    if (this.windowSize) return this.windowSize;
    const sid = await this.ensureSession();
    const data = await this.getJson(`/session/${sid}/window/size`);
    const value = (data.value ?? data) as Json;
    const width = Number(value.width);
    const height = Number(value.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error("WDA window/size missing width/height");
    }
    this.windowSize = { width, height };
    return this.windowSize;
  }

  async tap(x: number, y: number): Promise<void> {
    const size = await this.getWindowSize();
    const px = normalizedToPixels(x, y, size.width, size.height);
    const sid = await this.ensureSession();
    await this.postJson(`/session/${sid}/wda/tap`, { x: px.x, y: px.y });
  }

  async pressButton(name: HardwareButton): Promise<void> {
    const wdaName = BUTTON_MAP[name];
    if (!wdaName) {
      throw new Error(
        `Button '${name}' is unsupported on device/WDA in serve-device v1`,
      );
    }
    const sid = await this.ensureSession();
    await this.postJson(`/session/${sid}/wda/pressButton`, { name: wdaName });
  }

  async performGesture(events: GesturePointEvent[]): Promise<void> {
    const plan = collapseGestureEvents(events);
    if (plan.kind === "tap") {
      await this.tap(plan.x, plan.y);
      return;
    }
    const size = await this.getWindowSize();
    const from = normalizedToPixels(plan.x1, plan.y1, size.width, size.height);
    const to = normalizedToPixels(plan.x2, plan.y2, size.width, size.height);
    const sid = await this.ensureSession();
    // W3C actions drag
    await this.postJson(`/session/${sid}/actions`, {
      actions: [
        {
          type: "pointer",
          id: "finger1",
          parameters: { pointerType: "touch" },
          actions: [
            { type: "pointerMove", duration: 0, x: from.x, y: from.y },
            { type: "pointerDown", button: 0 },
            { type: "pointerMove", duration: 500, x: to.x, y: to.y },
            { type: "pointerUp", button: 0 },
          ],
        },
      ],
    });
  }

  private async getJson(path: string): Promise<Json> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`);
    if (!res.ok) {
      throw new Error(`WDA GET ${path} failed: HTTP ${res.status}`);
    }
    return (await res.json()) as Json;
  }

  private async postJson(path: string, body: unknown): Promise<Json> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `WDA POST ${path} failed: HTTP ${res.status}${text ? ` ${text}` : ""}`,
      );
    }
    try {
      return (await res.json()) as Json;
    } catch {
      return {};
    }
  }
}
