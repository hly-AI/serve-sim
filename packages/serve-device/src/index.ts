import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PRODUCT } from "./product";

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
  );

program.action(() => {
  console.error(
    `${PRODUCT.binName}: device streaming lands in a later release. Try \`${PRODUCT.binName} doctor\` or \`${PRODUCT.binName} --help\`.`,
  );
  process.exitCode = 1;
});

program.parse();
