/**
 * Physical-device screenshot capture with cascading backends.
 *
 * Order:
 *  1. `xcrun devicectl device capture screenshot` (newer Xcode)
 *  2. `idevicescreenshot` (legacy lockdown)
 *  3. `pymobiledevice3 developer dvt screenshot --userspace` (iOS 17+/26)
 */
import { execFileSync, type ExecFileSyncOptions } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { runDevicectl } from "./devicectl";

export type ExecFileSyncFn = (
  file: string,
  args: ReadonlyArray<string>,
  options?: ExecFileSyncOptions,
) => string | Buffer;

export function defaultPmd3Bin(): string {
  return (
    process.env.SERVE_DEVICE_PMD3?.trim() ||
    join(homedir(), "Library/Caches/serve-device/pmd3-venv/bin/pymobiledevice3")
  );
}

export function resolvePmd3Bin(opts?: {
  which?: (cmd: string) => string | null;
  existsSync?: (p: string) => boolean;
  preferred?: string;
}): string | null {
  const exists = opts?.existsSync ?? existsSync;
  const preferred = opts?.preferred ?? defaultPmd3Bin();
  if (preferred && exists(preferred)) return preferred;

  const which =
    opts?.which ??
    ((cmd: string) => {
      try {
        return (
          execFileSync("which", [cmd], { encoding: "utf-8" }).trim() || null
        );
      } catch {
        return null;
      }
    });
  return which("pymobiledevice3");
}

function toJpegIfPossible(
  srcPath: string,
  destJpg: string,
  exec: ExecFileSyncFn,
): Buffer {
  try {
    exec("sips", ["-s", "format", "jpeg", srcPath, "--out", destJpg], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return readFileSync(destJpg);
  } catch {
    return readFileSync(srcPath);
  }
}

export function captureDeviceScreenshot(
  udid: string,
  deps?: {
    runDevicectl?: typeof runDevicectl;
    execFileSync?: ExecFileSyncFn;
    pmd3Bin?: string | null;
    mkTempDir?: () => string;
  },
): Buffer {
  const run = deps?.runDevicectl ?? runDevicectl;
  const exec = deps?.execFileSync ?? execFileSync;
  const dir =
    deps?.mkTempDir?.() ?? mkdtempSync(join(tmpdir(), "serve-device-shot-"));
  const destPng = join(dir, "shot.png");
  const destJpg = join(dir, "shot.jpg");
  const errors: string[] = [];

  try {
    try {
      run([
        "device",
        "capture",
        "screenshot",
        "--device",
        udid,
        "--destination",
        destPng,
      ]);
      return toJpegIfPossible(destPng, destJpg, exec);
    } catch (err) {
      errors.push(
        `devicectl: ${err instanceof Error ? err.message : String(err)}`.trim(),
      );
    }

    try {
      exec("idevicescreenshot", ["-u", udid, destPng], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return toJpegIfPossible(destPng, destJpg, exec);
    } catch (err) {
      errors.push(
        `idevicescreenshot: ${err instanceof Error ? err.message : String(err)}`.trim(),
      );
    }

    const pmd3 =
      deps?.pmd3Bin !== undefined ? deps.pmd3Bin : resolvePmd3Bin();
    if (!pmd3) {
      errors.push(
        "pymobiledevice3: not found. Install Python 3.12+ then:\n" +
          "  python3.12 -m venv ~/Library/Caches/serve-device/pmd3-venv\n" +
          "  ~/Library/Caches/serve-device/pmd3-venv/bin/pip install -U pymobiledevice3\n" +
          "Or set SERVE_DEVICE_PMD3 to the pymobiledevice3 binary.",
      );
    } else {
      try {
        // iOS 17+: DVT screenshot over in-process userspace tunnel (no sudo).
        exec(
          pmd3,
          [
            "developer",
            "dvt",
            "screenshot",
            "--userspace",
            "--udid",
            udid,
            destPng,
          ],
          {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 60_000,
          },
        );
        return toJpegIfPossible(destPng, destJpg, exec);
      } catch (err) {
        errors.push(
          `pymobiledevice3: ${err instanceof Error ? err.message : String(err)}`.trim(),
        );
      }
    }

    throw new Error(
      `screenshot failed for ${udid}.\n${errors.join("\n")}`,
    );
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}
