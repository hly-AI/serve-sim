import { describe, expect, test } from "bun:test";
import { Command } from "commander";

/**
 * Parent `serve-device` declares `-d/--device` for the default preview action.
 * Subcommands like `setup` also need `-d`. Without enablePositionalOptions,
 * Commander assigns the flag to the parent and setup's requiredOption fails.
 */
describe("CLI --device option ownership", () => {
  test("setup receives --device when enablePositionalOptions is on", () => {
    let seen: { device?: string; teamId?: string } | undefined;
    const program = new Command();
    program.exitOverride();
    program.enablePositionalOptions();
    program.option("-d, --device <udid|name>", "Target physical device");
    program
      .command("setup")
      .requiredOption("-d, --device <udid|name>", "Target device")
      .option("--team-id <id>", "Team ID")
      .action((opts: { device: string; teamId?: string }) => {
        seen = opts;
      });

    program.parse(
      ["node", "serve-device", "setup", "--device", "UDID-1", "--team-id", "TEAM"],
      { from: "node" },
    );

    expect(seen).toEqual({ device: "UDID-1", teamId: "TEAM" });
  });

  test("without enablePositionalOptions, setup required --device is missing", () => {
    const program = new Command();
    program.exitOverride();
    program.option("-d, --device <udid|name>", "Target physical device");
    program
      .command("setup")
      .requiredOption("-d, --device <udid|name>", "Target device")
      .option("--team-id <id>", "Team ID")
      .action(() => {});

    expect(() =>
      program.parse(
        [
          "node",
          "serve-device",
          "setup",
          "--device",
          "UDID-1",
          "--team-id",
          "TEAM",
        ],
        { from: "node" },
      ),
    ).toThrow(/required option.*device/i);
  });
});
