import { describe, expect, it } from "vitest";

import {
  createSplitState,
  stepSplit,
  tapSplit,
  TILT,
  tiltToOffset,
} from "./tilt.sim";

/** Runs a steady tilt for `seconds` at 60 fps from `from` (s). */
const hold = (
  s: ReturnType<typeof createSplitState>,
  deg: number | null,
  seconds: number,
  from = 0,
) => {
  for (let t = 0; t <= seconds; t += 1 / 60) stepSplit(s, deg, from + t);
  return s;
};

describe("tiltToOffset", () => {
  it("ignores small wobbles", () => {
    expect(tiltToOffset(0)).toBe(0);
    expect(tiltToOffset(TILT.deadZone - 0.5)).toBe(0);
    expect(tiltToOffset(-(TILT.deadZone - 0.5))).toBe(0);
  });

  it("leaning left moves the line right (more angel), and back", () => {
    expect(tiltToOffset(12)).toBeGreaterThan(0);
    expect(tiltToOffset(-12)).toBeLessThan(0);
    expect(tiltToOffset(-12)).toBeCloseTo(-tiltToOffset(12));
  });

  it("reaches an extreme at about 25° and grows smoothly", () => {
    expect(tiltToOffset(TILT.full)).toBeCloseTo(TILT.reach);
    expect(tiltToOffset(40)).toBeCloseTo(TILT.reach);
    let last = 0;
    for (let d = 0; d <= 30; d += 1) {
      const o = tiltToOffset(d);
      expect(o).toBeGreaterThanOrEqual(last);
      expect(o - last).toBeLessThan(0.05);
      last = o;
    }
  });
});

describe("stepSplit", () => {
  it("upright sits in the middle and drifts back slowly", () => {
    const s = hold(createSplitState(), 0, 0.5);
    expect(s.target).toBe(0.5);
    expect(s.glide).toBe(TILT.settle);
    hold(s, 15, 0.2);
    expect(s.target).toBeGreaterThan(0.5);
    expect(s.glide).toBe(TILT.follow);
  });

  it("no face is upright", () => {
    const s = hold(createSplitState(), null, 0.5);
    expect(s.target).toBe(0.5);
    expect(s.takeover).toBeNull();
  });

  it("a full tilt held a second takes over, with one burst", () => {
    const s = hold(createSplitState(), 28, 0.9);
    expect(s.takeover).toBeNull();
    expect(s.target).toBeCloseTo(0.9);
    hold(s, 28, 0.3, 0.9);
    expect(s.takeover).toBe("angel");
    expect(s.target).toBeGreaterThan(1);
    expect(s.bursts).toBe(1);
    expect(s.burstSide).toBe("angel");
    hold(s, 28, 2, 1.2);
    expect(s.bursts).toBe(1);
  });

  it("the devil side takes over the other way, off the left edge", () => {
    const s = hold(createSplitState(), -30, 1.2);
    expect(s.takeover).toBe("devil");
    expect(s.target).toBeLessThan(0);
  });

  it("straightening up lets go; a brief full tilt does not take over", () => {
    const s = hold(createSplitState(), -30, 1.2);
    hold(s, -20, 0.2, 1.2);
    expect(s.takeover).toBe("devil");
    hold(s, -5, 0.2, 1.4);
    expect(s.takeover).toBeNull();
    expect(s.target).toBeGreaterThanOrEqual(0.1);
    const t = hold(createSplitState(), 30, 0.6);
    hold(t, 10, 0.2, 0.6);
    hold(t, 30, 0.6, 0.8);
    expect(t.takeover).toBeNull();
  });

  it("a real tilt marks the hint done; a wobble does not", () => {
    const s = hold(createSplitState(), 6, 1);
    expect(s.tilted).toBe(false);
    hold(s, -14, 0.1, 1);
    expect(s.tilted).toBe(true);
  });
});

describe("tapSplit", () => {
  it("grows the side tapped (like leaning toward it), adds to the tilt, and stays in range", () => {
    const s = createSplitState();
    tapSplit(s, 0.2, 1);
    stepSplit(s, 0, 1);
    // Tapping the heaven half (left) moves the line right: more angel.
    expect(s.target).toBeCloseTo(0.5 + TILT.nudge);
    expect(Math.sign(s.target - 0.5)).toBe(Math.sign(tiltToOffset(15)));
    tapSplit(s, 0.8, 2);
    tapSplit(s, 0.8, 3);
    stepSplit(s, 0, 3);
    expect(s.target).toBeCloseTo(0.5 - TILT.nudge);
    for (let i = 0; i < 10; i += 1) tapSplit(s, 0.1, 4 + i);
    stepSplit(s, 20, 20);
    expect(s.target).toBeCloseTo(0.9);
  });

  it("a double tap recentres", () => {
    const s = createSplitState();
    tapSplit(s, 0.9, 1);
    tapSplit(s, 0.9, 2);
    tapSplit(s, 0.4, 2.2);
    stepSplit(s, 0, 2.2);
    expect(s.nudge).toBe(0);
    expect(s.target).toBe(0.5);
  });
});
