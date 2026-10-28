// How your head moves the line — pure, unit-tested (tilt.test.ts).
//
// Tilt your head toward a side and that side grows across you: on screen,
// leaning toward the heaven side (left) pushes the line right, so more of you
// is angel, and the other way round. A small dead zone around upright keeps
// wobbles still; past it the tilt maps smoothly onto the line's range, about
// 25° reaching an extreme. Hold a full tilt about a second and that side takes
// over: the line sweeps off the edge (with a burst) until you straighten up.
// Taps nudge the line toward the side you tap; a double tap recentres it.
import type { Side } from "./split";

export const TILT = {
  /** Degrees of tilt that do nothing. */
  deadZone: 4,
  /** Degrees of tilt that reach an extreme. */
  full: 25,
  /** How far an extreme is from the middle (the line spans 0.1–0.9). */
  reach: 0.4,
  /** Seconds a full tilt is held before that side takes over. */
  hold: 1,
  /** Below this tilt (degrees) a takeover lets go. */
  release: 16,
  /** Where the line sits in a takeover: just past the edge, glow and all. */
  off: 0.09,
  /** A tap moves the line this far, up to this far from the middle. */
  nudge: 0.1,
  maxNudge: 0.4,
  /** Two taps within this many seconds are a double tap. */
  doubleTap: 0.3,
  /** A tilt this big (degrees) is a real one: the hint goes for good. */
  real: 12,
  /** Glide speeds (per second): following, drifting back, sweeping off. */
  follow: 7,
  settle: 2.5,
  sweep: 5,
};

/**
 * Tilt in degrees (+ = the top of your head leans toward the screen's left)
 * → how far the line moves from the middle (+ = right, more angel).
 */
export const tiltToOffset = (deg: number) => {
  const t = Math.min(
    1,
    Math.max(0, (Math.abs(deg) - TILT.deadZone) / (TILT.full - TILT.deadZone)),
  );
  // Smooth at both ends: no jump out of the dead zone, a soft landing.
  if (t === 0) return 0;
  const s = t * t * (3 - 2 * t);
  return Math.sign(deg) * s * TILT.reach;
};

/** The side a tilt leans toward. */
export const tiltSide = (deg: number): Side => (deg > 0 ? "angel" : "devil");

export type SplitState = {
  /** From taps, added to the tilt. */
  nudge: number;
  /** The side being held at full tilt, and since when (s). */
  holding: Side | null;
  holdSince: number;
  /** The side that has taken over, or none. */
  takeover: Side | null;
  /** Bumps on each takeover (the burst plays), and which side and when. */
  bursts: number;
  burstSide: Side;
  burstAt: number;
  /** A real tilt has happened (the hint is done). */
  tilted: boolean;
  /** When (s) the last tap landed, and where the line should go. */
  lastTap: number;
  target: number;
  /** How quickly the line glides there now (per second). */
  glide: number;
};

export const createSplitState = (): SplitState => ({
  nudge: 0,
  holding: null,
  holdSince: 0,
  takeover: null,
  bursts: 0,
  burstSide: "angel",
  burstAt: -Infinity,
  tilted: false,
  lastTap: -Infinity,
  target: 0.5,
  glide: TILT.follow,
});

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/** A tap on the left (x < 0.5) or right half of the picture at time `now`. */
export const tapSplit = (s: SplitState, x: number, now: number) => {
  if (now - s.lastTap < TILT.doubleTap) {
    s.nudge = 0;
    s.lastTap = -Infinity;
    return;
  }
  s.lastTap = now;
  // The line moves toward the side you tap.
  const dir = x < 0.5 ? -1 : 1;
  s.nudge = clamp(s.nudge + dir * TILT.nudge, -TILT.maxNudge, TILT.maxNudge);
};

/**
 * One frame: the head's tilt in degrees (null with no face) at time `now`
 * (s) → the line's target and glide speed, takeovers and bursts.
 */
export const stepSplit = (s: SplitState, deg: number | null, now: number) => {
  const tilt = deg ?? 0;
  const a = Math.abs(tilt);
  if (a >= TILT.real) s.tilted = true;

  // Takeover: a full tilt held long enough; straightening up lets go.
  if (s.takeover) {
    if (a < TILT.release || tiltSide(tilt) !== s.takeover) {
      s.takeover = null;
      s.holding = null;
    }
  } else if (a >= TILT.full) {
    const side = tiltSide(tilt);
    if (s.holding !== side) {
      s.holding = side;
      s.holdSince = now;
    } else if (now - s.holdSince >= TILT.hold) {
      s.takeover = side;
      s.bursts += 1;
      s.burstSide = side;
      s.burstAt = now;
    }
  } else s.holding = null;

  if (s.takeover) {
    s.target = s.takeover === "angel" ? 1 + TILT.off : -TILT.off;
    s.glide = TILT.sweep;
    return s;
  }
  s.target = clamp(0.5 + tiltToOffset(tilt) + s.nudge, 0.1, 0.9);
  // Upright: drift back to the mix, slower than following a tilt.
  s.glide = a < TILT.deadZone ? TILT.settle : TILT.follow;
  return s;
};
