import { describe, expect, test } from "bun:test";
import {
  SERVE_DEVICE_PRODUCT,
  SERVE_SIM_PRODUCT,
} from "../product-identity";

describe("product identity", () => {
  test("serve-sim and serve-device do not share state dir or default ports", () => {
    expect(SERVE_SIM_PRODUCT.stateDirName).toBe("serve-sim");
    expect(SERVE_DEVICE_PRODUCT.stateDirName).toBe("serve-device");
    expect(SERVE_SIM_PRODUCT.defaultPreviewPort).not.toBe(
      SERVE_DEVICE_PRODUCT.defaultPreviewPort,
    );
    expect(SERVE_SIM_PRODUCT.defaultHelperPort).not.toBe(
      SERVE_DEVICE_PRODUCT.defaultHelperPort,
    );
    expect(SERVE_DEVICE_PRODUCT.binName).toBe("serve-device");
    expect(SERVE_DEVICE_PRODUCT.defaultPreviewPort).toBe(4200);
    expect(SERVE_DEVICE_PRODUCT.defaultHelperPort).toBe(4100);
  });
});
