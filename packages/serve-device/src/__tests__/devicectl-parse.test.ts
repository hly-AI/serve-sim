import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import {
  isNetworkTransport,
  isTunnelConnected,
  parseDevicectlListDevicesJson,
} from "../backends/devicectl";

const fixturePath = join(
  import.meta.dir,
  "../backends/fixtures/devicectl-list.json",
);

describe("parseDevicectlListDevicesJson", () => {
  const devices = parseDevicectlListDevicesJson(
    readFileSync(fixturePath, "utf-8"),
  );

  test("extracts udid and name from hardware/device properties", () => {
    const wired = devices.find((d) => d.name === "Evan's iPhone");
    expect(wired?.udid).toBe("00008150-00156C6C3A40C01C");
    expect(wired?.reality).toBe("physical");
    expect(wired?.connectionProperties?.transportType).toBe("wired");
    expect(wired?.connectionProperties?.tunnelState).toBe("connected");
  });

  test("identifies localNetwork as network transport", () => {
    const wifi = devices.find((d) => d.name === "WiFi Only Phone");
    expect(isNetworkTransport(wifi?.connectionProperties?.transportType)).toBe(
      true,
    );
    expect(isNetworkTransport("wired")).toBe(false);
    expect(isNetworkTransport(undefined)).toBe(false);
  });

  test("tunnel connected helper", () => {
    expect(isTunnelConnected("connected")).toBe(true);
    expect(isTunnelConnected("unavailable")).toBe(false);
    expect(isTunnelConnected("disconnected")).toBe(false);
  });

  test("fixture includes simulated and offline physical entries", () => {
    expect(devices.some((d) => d.reality === "simulated")).toBe(true);
    expect(
      devices.some(
        (d) =>
          d.name === "Paired But Offline" &&
          d.connectionProperties?.tunnelState === "unavailable",
      ),
    ).toBe(true);
  });
});
