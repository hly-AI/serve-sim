import { describe, expect, test } from "bun:test";
import { collapseGestureEvents } from "../wda/wda-gesture";

describe("collapseGestureEvents", () => {
  test("begin+end without move is a tap", () => {
    expect(
      collapseGestureEvents([
        { type: "begin", x: 0.2, y: 0.3 },
        { type: "end", x: 0.2, y: 0.3 },
      ]),
    ).toEqual({ kind: "tap", x: 0.2, y: 0.3 });
  });

  test("begin+move+end is a drag", () => {
    expect(
      collapseGestureEvents([
        { type: "begin", x: 0.2, y: 0.3 },
        { type: "move", x: 0.2, y: 0.5 },
        { type: "end", x: 0.2, y: 0.8 },
      ]),
    ).toEqual({ kind: "drag", x1: 0.2, y1: 0.3, x2: 0.2, y2: 0.8 });
  });

  test("empty throws", () => {
    expect(() => collapseGestureEvents([])).toThrow(/empty/);
  });
});
