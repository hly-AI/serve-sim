import type { IncomingMessage, ServerResponse } from "http";

export interface FrameSource {
  /** Return one JPEG (or PNG-as-JPEG-ish) buffer; called while clients are connected. */
  capture(): Promise<Buffer>;
}

const BOUNDARY = "frame";
const TRAILER = Buffer.from("\r\n", "ascii");

function mjpegHeader(jpegLength: number): Buffer {
  return Buffer.from(
    `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegLength}\r\n\r\n`,
    "ascii",
  );
}

/**
 * Polls a FrameSource and fans frames out as multipart MJPEG while clients
 * are connected. Stops the timer when the last client disconnects.
 */
export class DeviceCaptureSession {
  private clients = new Set<ServerResponse>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private lastFrame: Buffer | null = null;
  private capturing = false;
  private lastCaptureError: string | null = null;

  constructor(
    readonly udid: string,
    private readonly source: FrameSource,
    opts?: { fps?: number },
  ) {
    const fps = opts?.fps ?? 5;
    this.intervalMs = Math.max(50, Math.floor(1000 / fps));
  }

  handleHealth(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        status: "ok",
        udid: this.udid,
        hasFrame: this.lastFrame != null,
        lastCaptureError: this.lastCaptureError,
        clients: this.clients.size,
      }),
    );
  }

  handleConfig(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({ width: 0, height: 0, orientation: "portrait" }),
    );
  }

  handleMjpeg(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    this.clients.add(res);
    res.on("close", () => {
      this.clients.delete(res);
      if (this.clients.size === 0) this.stopTimer();
    });
    if (this.lastFrame) this.writeFrame(res, this.lastFrame);
    this.ensureTimer();
  }

  close(): void {
    this.stopTimer();
    for (const res of this.clients) {
      try {
        res.end();
      } catch {}
    }
    this.clients.clear();
  }

  /** Test helper: force one capture tick. */
  async tickForTest(): Promise<void> {
    await this.captureOnce();
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.captureOnce();
    }, this.intervalMs);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async captureOnce(): Promise<void> {
    if (this.capturing || this.clients.size === 0) return;
    this.capturing = true;
    try {
      const frame = await this.source.capture();
      this.lastFrame = frame;
      this.lastCaptureError = null;
      for (const res of this.clients) {
        this.writeFrame(res, frame);
      }
    } catch (err) {
      // Drop failed captures; next tick retries. Surface reason on /health.
      this.lastCaptureError =
        err instanceof Error ? err.message : String(err);
    } finally {
      this.capturing = false;
    }
  }

  private writeFrame(res: ServerResponse, jpeg: Buffer): void {
    try {
      res.write(mjpegHeader(jpeg.length));
      res.write(jpeg);
      res.write(TRAILER);
    } catch {
      this.clients.delete(res);
    }
  }
}
