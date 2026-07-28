import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PRODUCT } from "./product";
import { killStreams, listStreams } from "./cli/list-kill";

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

program.parse();
