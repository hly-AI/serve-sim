import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { execFileSync, spawn } from "child_process";

export interface SetupOpts {
  udid: string;
  /** Local path to WebDriverAgent repo; default under ~/Library/Caches/serve-device/wda */
  wdaPath?: string;
  /** Apple Developer Team ID */
  teamId?: string;
  log?: (line: string) => void;
  /** Injected for tests — skip real clone/build */
  runCommand?: (
    cmd: string,
    args: string[],
    opts?: { cwd?: string },
  ) => void;
  spawnDetached?: typeof spawn;
}

export function defaultWdaCachePath(): string {
  return join(homedir(), "Library", "Caches", "serve-device", "wda");
}

/**
 * Prepare WebDriverAgent for a USB device.
 *
 * This does NOT distribute a prebuilt IPA. It clones Appium's WebDriverAgent
 * (if needed) and runs xcodebuild. First-run may require Trust dialogs in
 * Settings on the phone and signing via Xcode GUI.
 */
export async function runSetup(opts: SetupOpts): Promise<void> {
  const log = opts.log ?? console.log;
  const run =
    opts.runCommand ??
    ((cmd: string, args: string[], o?: { cwd?: string }) => {
      execFileSync(cmd, args, {
        cwd: o?.cwd,
        stdio: "inherit",
      });
    });

  const teamId = opts.teamId ?? process.env.SERVE_DEVICE_TEAM_ID;
  if (!teamId) {
    throw new Error(
      "Missing team id. Pass --team-id <TEAMID> or set SERVE_DEVICE_TEAM_ID.",
    );
  }

  const wdaPath = opts.wdaPath ?? defaultWdaCachePath();
  mkdirSync(join(wdaPath, ".."), { recursive: true });

  if (!existsSync(join(wdaPath, "WebDriverAgent.xcodeproj"))) {
    log(`Cloning WebDriverAgent into ${wdaPath} …`);
    run("git", [
      "clone",
      "--depth",
      "1",
      "https://github.com/appium/WebDriverAgent.git",
      wdaPath,
    ]);
  } else {
    log(`Using existing WebDriverAgent at ${wdaPath}`);
  }

  log("");
  log("Building WebDriverAgentRunner for device…");
  log(
    "If Xcode asks you to select a team / trust the developer certificate, do that in the GUI, then re-run setup.",
  );
  log(
    "On the iPhone: Settings → General → VPN & Device Management → trust this developer.",
  );
  log("");

  // Scheme name verified against Appium WebDriverAgent repo.
  run(
    "xcodebuild",
    [
      "-project",
      "WebDriverAgent.xcodeproj",
      "-scheme",
      "WebDriverAgentRunner",
      "-destination",
      `id=${opts.udid}`,
      `-allowProvisioningUpdates`,
      `DEVELOPMENT_TEAM=${teamId}`,
      "test",
    ],
    { cwd: wdaPath },
  );

  log("");
  log("WDA test runner launched via xcodebuild.");
  log(
    "Forward port 8100 if needed (install libimobiledevice `iproxy`, then: iproxy 8100 8100).",
  );
  log(`Then: serve-device doctor -d ${opts.udid}`);
  log(`WDA URL default: http://127.0.0.1:8100 (override with SERVE_DEVICE_WDA_URL)`);
}
