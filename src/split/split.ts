// The line that splits you in half. Left of it is heaven, right of it is
// hell; everything in the picture (backgrounds, the light on your skin, the
// pieces you wear, the particles) reads the same line, so when it moves the
// whole picture follows. Positions are across the picture: 0 = left edge,
// 1 = right edge.
import { Vector2, type Material, type Texture } from "three";

/** Where the line may go, and how far one dev key moves it. */
export const SPLIT = {
  centre: 0.5,
  min: 0.1,
  max: 0.9,
  step: 0.05,
  /** How quickly the line glides to where it is sent (per second, ease-out). */
  glide: 7,
};

export const split = {
  /** Where the line is drawn now. */
  x: SPLIT.centre,
  /** Where it is gliding to. */
  target: SPLIT.centre,
};

export const clampSplit = (x: number) =>
  Math.min(SPLIT.max, Math.max(SPLIT.min, x));

/** One frame of the glide toward the target: exponential, no overshoot. */
export const glideSplit = (x: number, target: number, dt: number) =>
  x + (target - x) * (1 - Math.exp(-SPLIT.glide * Math.min(dt, 0.1)));

/** Shared by every shader that reads the line or the portrait mask. */
export const shared = {
  split: { value: SPLIT.centre },
  /** The portrait mask (green = you). */
  mask: { value: null as Texture | null },
  /** Drawing-buffer size in pixels: gl_FragCoord → picture position. */
  size: { value: new Vector2(1, 1) },
};

/** Which world a piece belongs to. */
export type Side = "angel" | "devil";

const patched = new WeakSet<Material>();

/**
 * Keeps a material on its own side of the line (and, for things that hang
 * behind you, out of wherever the portrait mask says you are).
 */
export const keepToSide = (
  material: Material,
  side: Side,
  behindPerson = false,
) => {
  if (patched.has(material)) return;
  patched.add(material);
  // Angel keeps what is left of the line, devil what is right of it.
  const cut = side === "angel" ? "< 0.0" : "> 0.0";
  const before = material.onBeforeCompile;
  // eslint-disable-next-line no-param-reassign
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    /* eslint-disable no-param-reassign */
    shader.uniforms.splitX = shared.split;
    shader.uniforms.personMask = shared.mask;
    shader.uniforms.personMaskSize = shared.size;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform float splitX;\nuniform sampler2D personMask;\nuniform vec2 personMaskSize;\nvoid main() {",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
if (splitX - gl_FragCoord.x / personMaskSize.x ${cut}) discard;
${behindPerson ? "if (texture2D(personMask, gl_FragCoord.xy / personMaskSize).g > 0.5) discard;" : ""}`,
      );
    /* eslint-enable no-param-reassign */
  };
  // eslint-disable-next-line no-param-reassign
  material.customProgramCacheKey = () =>
    `split-${side}${behindPerson ? "-behind" : ""}`;
  // eslint-disable-next-line no-param-reassign
  material.needsUpdate = true;
};
