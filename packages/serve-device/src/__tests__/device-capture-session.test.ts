import { describe, expect, test } from "bun:test";
import type { ServerResponse } from "http";
import { DeviceCaptureSession } from "../session/device-capture-session";

class FakeRes {
  statusCode = 0;
  headers: Record<string, string> = {};
  chunks: Buffer[] = [];
  private listeners = new Map<string, Array<() => void>>();

  writeHead(code: number, headers: Record<string, string>) {
    this.statusCode = code;
    this.headers = headers;
  }
  write(chunk: Buffer | string) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }
  end() {}
  on(event: string, cb: () => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(cb);
    this.listeners.set(event, list);
    return this;
  }
}

describe("DeviceCaptureSession", () => {
  test("handleMjpeg sets multipart content-type and writes a frame after tick", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // minimal SOI/EOI
    const session = new DeviceCaptureSession(
      "UDID",
      {
        async capture() {
          return jpeg;
        },
      },
      { fps: 20 },
    );
    const res = new FakeRes();
    session.handleMjpeg({} as any, res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain(
      "multipart/x-mixed-replace",
    );
    await session.tickForTest();
    const body = Buffer.concat(res.chunks).toString("latin1");
    expect(body).toContain("Content-Type: image/jpeg");
    expect(body).toContain(jpeg.toString("latin1"));
    session.close();
  });
});
