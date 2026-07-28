import type { GesturePointEvent } from "serve-runtime";

export type CollapsedGesture =
  | { kind: "tap"; x: number; y: number }
  | { kind: "drag"; x1: number; y1: number; x2: number; y2: number };

/**
 * Collapse begin/move/end gesture JSON into a single tap or drag.
 * - No move (or only begin+end at same point) → tap at begin (or end).
 * - Any move / distinct end → drag from first begin to last end.
 */
export function collapseGestureEvents(
  events: GesturePointEvent[],
): CollapsedGesture {
  if (events.length === 0) {
    throw new Error("gesture events array is empty");
  }
  const begin = events.find((e) => e.type === "begin") ?? events[0]!;
  const end =
    [...events].reverse().find((e) => e.type === "end") ??
    events[events.length - 1]!;
  const moved = events.some(
    (e) =>
      e.type === "move" ||
      (e.type === "end" &&
        (Math.hypot(e.x - begin.x, e.y - begin.y) > 0.004)),
  );
  if (!moved) {
    return { kind: "tap", x: begin.x, y: begin.y };
  }
  return { kind: "drag", x1: begin.x, y1: begin.y, x2: end.x, y2: end.y };
}
