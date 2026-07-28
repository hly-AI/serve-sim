import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "http";
import { unlinkSync } from "fs";
import type { DeviceBackend } from "serve-runtime";
import { DeviceCaptureSession } from "../session/device-capture-session";
import {
  inProcessServeDeviceState,
  stateFileForDevice,
  writeServeDeviceState,
} from "../state";

const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>serve-device</title>
    <style>
      html, body { margin: 0; height: 100%; background: #111; color: #eee;
        font-family: ui-sans-serif, system-ui, sans-serif; }
      main { display: flex; flex-direction: column; align-items: center;
        justify-content: center; min-height: 100%; gap: 12px; padding: 16px;
        box-sizing: border-box; }
      img { max-width: min(100%, 420px); width: 100%; height: auto;
        background: #000; border: 1px solid #333; }
      code { font-size: 12px; opacity: 0.8; }
    </style>
  </head>
  <body>
    <main>
      <img id="stream" alt="device stream" />
      <code id="meta"></code>
    </main>
    <script>
      const udid = "__UDID__";
      const img = document.getElementById("stream");
      const meta = document.getElementById("meta");
      img.src = "/helper/" + encodeURIComponent(udid) + "/stream.mjpeg";
      meta.textContent = "serve-device · " + udid + " · USB MJPEG";
    </script>
  </body>
</html>
`;

export async function startPreviewServer(opts: {
  port: number;
  host: string;
  udid: string;
  backend: DeviceBackend;
  fps?: number;
}): Promise<{ port: number; stop: () => void; server: Server }> {
  const session = new DeviceCaptureSession(
    opts.udid,
    {
      async capture() {
        const shot = await opts.backend.screenshot(opts.udid);
        return shot.bytes;
      },
    },
    { fps: opts.fps ?? 5 },
  );

  const html = HTML_TEMPLATE.replaceAll("__UDID__", opts.udid);

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${opts.port}`);
    const path = url.pathname;

    if (path === "/" || path === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    const helperMatch = path.match(
      /^\/helper\/([^/]+)\/(stream\.mjpeg|health|config)$/,
    );
    if (helperMatch) {
      const udid = decodeURIComponent(helperMatch[1]!);
      if (udid !== opts.udid) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("unknown device");
        return;
      }
      const kind = helperMatch[2]!;
      if (kind === "stream.mjpeg") {
        session.handleMjpeg(req, res);
        return;
      }
      if (kind === "health") {
        session.handleHealth(req, res);
        return;
      }
      session.handleConfig(req, res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, opts.host, () => resolve());
  });

  const address = server.address();
  const boundPort =
    address && typeof address === "object" ? address.port : opts.port;

  writeServeDeviceState(
    inProcessServeDeviceState(opts.udid, boundPort, "/", opts.host),
  );

  const stop = () => {
    session.close();
    try {
      unlinkSync(stateFileForDevice(opts.udid));
    } catch {}
    server.close();
  };

  return { port: boundPort, stop, server };
}
