import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PRODUCT } from "./product";
import { killStreams, listStreams } from "./cli/list-kill";
import {
  defaultBackend,
  runButton,
  runDoctor,
  runGesture,
  runInstall,
  runLaunch,
  runScreenshot,
  runTap,
} from "./cli/backend-commands";
import { startPreviewServer } from "./server/preview-server";
import { spawn } from "child_process";

function resolveVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
        "utf8",
      ),
    );
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function withErrors(fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

async function servePreview(opts: {
  port?: number;
  host?: string;
  device?: string;
  quiet?: boolean;
}): Promise<void> {
  const backend = defaultBackend();
  const udid = opts.device
    ? await backend.resolveDevice(opts.device)
    : await (async () => {
        const listed = await backend.listDevices();
        const hit = listed.find((d) => d.available) ?? listed[0];
        if (!hit) {
          throw new Error(
            "No USB iOS device available. Plug in a device and trust this computer.",
          );
        }
        return hit.udid;
      })();

  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? PRODUCT.defaultPreviewPort;
  const { port: bound, stop } = await startPreviewServer({
    port,
    host,
    udid,
    backend,
  });

  const clear = () => {
    try {
      stop();
    } catch {}
  };
  process.on("exit", clear);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  if (!opts.quiet) {
    console.log("");
    console.log(`  - Local:   http://localhost:${bound}`);
    console.log(`  - Device:  ${udid}`);
    console.log("");
  } else {
    console.log(
      JSON.stringify({
        url: `http://127.0.0.1:${bound}`,
        streamUrl: `http://127.0.0.1:${bound}/helper/${udid}/stream.mjpeg`,
        wsUrl: `ws://127.0.0.1:${bound}/helper/${udid}/ws`,
        port: bound,
        device: udid,
        pid: process.pid,
      }),
    );
  }

  await new Promise(() => {});
}

function detachPreview(opts: {
  port?: number;
  host?: string;
  device?: string;
}): void {
  const args = [fileURLToPath(import.meta.url)];
  if (opts.port != null) args.push("-p", String(opts.port));
  if (opts.host) args.push("--host", opts.host);
  if (opts.device) args.push("-d", opts.device);
  args.push("-q");

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout?.on("data", (c) => {
    out += String(c);
  });
  child.stderr?.on("data", (c) => {
    out += String(c);
  });
  child.unref();
  // Give the child a moment to print JSON state; best-effort.
  setTimeout(() => {
    const line = out.trim().split("\n").filter(Boolean).pop() ?? out.trim();
    if (line) console.log(line);
    else
      console.log(
        JSON.stringify({
          detached: true,
          pid: child.pid,
          note: "serve-device started in background; use --list to confirm",
        }),
      );
    process.exit(0);
  }, 1500);
}

const program = new Command();
program
  .name(PRODUCT.binName)
  .description("Stream and control a physical iOS device from the browser / CLI")
  .version(resolveVersion(), "-v, --version")
  .option(
    "-p, --port <port>",
    `Starting port (preview default: ${PRODUCT.defaultPreviewPort})`,
    (v) => parseInt(v, 10),
  )
  .option(
    "--host <addr>",
    "Interface to bind (default 127.0.0.1)",
    "127.0.0.1",
  )
  .option("-d, --device <udid|name>", "Target physical device")
  .option("-l, --list", "List running serve-device servers as JSON")
  .option("-k, --kill", "Stop serve-device servers recorded in its state dir")
  .option("--detach", "Start preview server in the background")
  .option("-q, --quiet", "Quiet / JSON-only mode");

program.action(
  async (opts: {
    list?: boolean;
    kill?: boolean;
    quiet?: boolean;
    detach?: boolean;
    port?: number;
    host?: string;
    device?: string;
  }) => {
    if (opts.list) {
      const states = listStreams();
      if (opts.quiet) {
        console.log(JSON.stringify(states));
      } else if (states.length === 0) {
        console.log(JSON.stringify({ running: false }));
      } else if (states.length === 1) {
        const s = states[0]!;
        console.log(
          JSON.stringify({
            running: true,
            url: s.url,
            streamUrl: s.streamUrl,
            wsUrl: s.wsUrl,
            port: s.port,
            device: s.device,
            pid: s.pid,
          }),
        );
      } else {
        console.log(
          JSON.stringify({
            running: true,
            streams: states.map((s) => ({
              url: s.url,
              streamUrl: s.streamUrl,
              wsUrl: s.wsUrl,
              port: s.port,
              device: s.device,
              pid: s.pid,
            })),
          }),
        );
      }
      return;
    }

    if (opts.kill) {
      const before = listStreams();
      killStreams();
      console.log(
        JSON.stringify({
          disconnected: true,
          devices: before.map((s) => s.device),
        }),
      );
      return;
    }

    await withErrors(async () => {
      if (opts.detach) {
        detachPreview({
          port: opts.port,
          host: opts.host,
          device: opts.device,
        });
        return;
      }
      await servePreview({
        port: opts.port,
        host: opts.host,
        device: opts.device,
        quiet: opts.quiet,
      });
    });
  },
);

program
  .command("tap")
  .description("Tap at normalized (0..1) coordinates")
  .argument("<x>", "Normalized X")
  .argument("<y>", "Normalized Y")
  .option("-d, --device <udid|name>", "Target device")
  .action(async (x: string, y: string, opts: { device?: string }) => {
    await withErrors(() => runTap(x, y, opts.device));
  });

program
  .command("gesture")
  .description("Send gesture JSON (begin/move/end events)")
  .argument("<json>", "Gesture event array JSON")
  .option("-d, --device <udid|name>", "Target device")
  .action(async (json: string, opts: { device?: string }) => {
    await withErrors(() => runGesture(json, opts.device));
  });

program
  .command("button")
  .description("Press a hardware button")
  .argument("[name]", "Button name", "home")
  .option("-d, --device <udid|name>", "Target device")
  .action(async (name: string, opts: { device?: string }) => {
    await withErrors(() => runButton(name, opts.device));
  });

program
  .command("screenshot")
  .description("Capture a screenshot")
  .option("-d, --device <udid|name>", "Target device")
  .option("-o, --output <path>", "Output file path")
  .action(async (opts: { device?: string; output?: string }) => {
    await withErrors(() => runScreenshot(opts.device, opts.output));
  });

program
  .command("install")
  .description("Install an .app / .ipa onto the device")
  .argument("<path>", "Path to app bundle")
  .option("-d, --device <udid|name>", "Target device")
  .action(async (path: string, opts: { device?: string }) => {
    await withErrors(() => runInstall(path, opts.device));
  });

program
  .command("launch")
  .description("Launch an installed app by bundle id")
  .argument("<bundle-id>", "Bundle identifier")
  .option("-d, --device <udid|name>", "Target device")
  .action(async (bundleId: string, opts: { device?: string }) => {
    await withErrors(() => runLaunch(bundleId, opts.device));
  });

program
  .command("doctor")
  .description("Check host prerequisites for serve-device")
  .action(() => {
    const report = runDoctor();
    for (const line of report.lines) console.log(line);
    if (!report.ok) process.exitCode = 1;
  });

await program.parseAsync(process.argv);
