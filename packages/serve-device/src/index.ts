import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PRODUCT } from "./product";
import { killStreams, listStreams } from "./cli/list-kill";
import {
  runButton,
  runDoctor,
  runGesture,
  runInstall,
  runLaunch,
  runScreenshot,
  runTap,
} from "./cli/backend-commands";

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
  .option("-l, --list", "List running serve-device servers as JSON")
  .option("-k, --kill", "Stop serve-device servers recorded in its state dir")
  .option("-q, --quiet", "Quiet mode");

program.action((opts: { list?: boolean; kill?: boolean; quiet?: boolean }) => {
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

  console.error(
    `${PRODUCT.binName}: device streaming lands in a later release. Try \`${PRODUCT.binName} doctor\` or \`${PRODUCT.binName} --help\`.`,
  );
  process.exitCode = 1;
});

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
