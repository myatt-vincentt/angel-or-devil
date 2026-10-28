// What you wear: both outfits at once, each kept to its own side of the
// line, so the line shows you half angel, half devil and moving it changes
// how much of each. vincentt.studio head accessories
// (public/models/vincentt-*.glb), authored in metres in the "Complete 3D
// Reference - Spark AR" face frame (origin at the front of the face, +Y up,
// +Z out of the face) — see FRAME.
//   Heaven side: a golden halo and white feathered wings.
//   Hell side: red horns, a dark halo (the other half of the ring) and red
//   bat wings. (The devil fangs are made in code: Fangs.tsx.)
import type { Side } from "./split";

export type Part = {
  /** File name in public/models without `vincentt-` / `.glb`. */
  id: string;
  side: Side;
  /**
   * One of the file's own presets, by name: its finish, and its colour
   * variant of every material that has one (`mat_x` → `mat_x__<preset>`).
   * The first preset when unset.
   */
  preset?: string;
  /** Fine placement: `x` / `y` / `z` canonical cm, `scale` about its middle. */
  fit?: { x?: number; y?: number; z?: number; scale?: number };
  /** Always behind you: hidden wherever the portrait mask is. */
  behindPerson?: boolean;
  /** Tints and a soft glow by material name (on this part's own copies). */
  colors?: Record<string, string>;
  glow?: Record<string, string>;
};

/** On the head (FilteredHead). The two halos share one place. */
export const HEAD: readonly Part[] = [
  { id: "halo-angel", side: "angel", preset: "Golden" },
  { id: "halo-dark", side: "devil", preset: "Fallen" },
  { id: "horns-devil", side: "devil", preset: "Classic Red" },
];

/** On the shoulders (Wings.tsx), behind you. */
export const WINGS: readonly Part[] = [
  {
    id: "wings-angel",
    side: "angel",
    preset: "Golden",
    // Warm ivory rather than paper white, so they read on the bright sky.
    colors: { mat_feathers: "#e9dcc2" },
    behindPerson: true,
  },
  {
    id: "wings-devil-bat",
    side: "devil",
    preset: "Devil Red",
    behindPerson: true,
  },
];

export const modelUrl = (id: string) => `/models/vincentt-${id}.glb`;

/** The SDK's v3 head occluder, hosted here until the SDK CDN serves it. */
export const OCCLUDER_URL = "/models/head-occluder-v3.glb";

/** The SDK's neck-and-shoulders bust occluder (same story). */
export const NECK_OCCLUDER_URL = "/models/neck-occluder-bust-v1.glb";

/**
 * The models' frame → the SDK's canonical head frame (centimetres): ×100,
 * then the same shift the SDK used to move the Spark AR reference into the
 * canonical frame (chins and nose tips aligned).
 */
export const FRAME = {
  scale: 100,
  position: [0, -1.03, 7.3] as const,
};
