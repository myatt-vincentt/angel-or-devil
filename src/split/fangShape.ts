// The devil fangs' shape, made in code: a slim, slightly curved cone from a
// wide root to a sharp tip, its cross-section a flattened oval. Colours run
// deep red at the root to glossy bone, and a `tip` value (0 at the root, 1 at
// the point) lets the material light an ember glow at the tips.
import { BufferAttribute, BufferGeometry, Color } from "three";

export type FangShape = {
  /** Root to tip (cm). */
  length: number;
  /** Root radius (cm). */
  radius: number;
  /** The tip's sideways curl (+X), as a share of the length. */
  curl: number;
  /** The tip's lean back toward the face (−Z), as a share of the length. */
  hook: number;
  /** Hangs down (an upper fang) or rises up (a lower one). */
  down: boolean;
};

const ROOT = new Color(0.28, 0.01, 0.015);
const BONE = new Color(0.8, 0.72, 0.6);
const RINGS = 14;
const SIDES = 12;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Point `t` (0 root … 1 tip) along the fang's spine. */
export const fangSpine = (s: FangShape, t: number) => ({
  x: s.curl * s.length * t * t,
  y: (s.down ? -1 : 1) * s.length * t,
  z: -s.hook * s.length * t * t,
});

/** Radius at `t`: full at the root, narrowing to a point. */
export const fangRadius = (s: FangShape, t: number) =>
  s.radius * (1 - t) ** 0.85;

export const fangGeometry = (s: FangShape) => {
  const count = RINGS * SIDES + 2;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const tip = new Float32Array(count);
  const c = new Color();
  const put = (
    i: number,
    p: { x: number; y: number; z: number },
    n: [number, number, number],
    t: number,
  ) => {
    pos.set([p.x, p.y, p.z], i * 3);
    nor.set(n, i * 3);
    c.copy(ROOT).lerp(BONE, smooth(0.2, 0.62, t));
    col.set([c.r, c.g, c.b], i * 3);
    tip[i] = t;
  };
  for (let r = 0; r < RINGS; r += 1) {
    const t = (r / RINGS) * 0.97;
    const centre = fangSpine(s, t);
    const rad = fangRadius(s, t);
    for (let k = 0; k < SIDES; k += 1) {
      const a = (k / SIDES) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      put(
        r * SIDES + k,
        { x: centre.x + nx * rad, y: centre.y, z: centre.z + nz * rad * 0.7 },
        [nx, 0, nz],
        t,
      );
    }
  }
  const tipIndex = RINGS * SIDES;
  const rootIndex = tipIndex + 1;
  put(tipIndex, fangSpine(s, 1), [0, s.down ? -1 : 1, 0], 1);
  put(rootIndex, fangSpine(s, 0), [0, s.down ? 1 : -1, 0], 0);

  const index: number[] = [];
  // Winding so the outside faces out whichever way the fang points.
  const quad = (a: number, b: number, d: number, e: number) =>
    s.down ? index.push(a, d, b, b, d, e) : index.push(a, b, d, b, e, d);
  for (let r = 0; r < RINGS - 1; r += 1)
    for (let k = 0; k < SIDES; k += 1) {
      const k2 = (k + 1) % SIDES;
      quad(
        r * SIDES + k,
        r * SIDES + k2,
        (r + 1) * SIDES + k,
        (r + 1) * SIDES + k2,
      );
    }
  const last = (RINGS - 1) * SIDES;
  for (let k = 0; k < SIDES; k += 1) {
    const k2 = (k + 1) % SIDES;
    if (s.down) {
      index.push(last + k, tipIndex, last + k2);
      index.push(rootIndex, k, k2);
    } else {
      index.push(last + k, last + k2, tipIndex);
      index.push(rootIndex, k2, k);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("normal", new BufferAttribute(nor, 3));
  g.setAttribute("color", new BufferAttribute(col, 3));
  g.setAttribute("tip", new BufferAttribute(tip, 1));
  g.setIndex(index);
  return g;
};
