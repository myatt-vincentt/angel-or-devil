// The wings, on your shoulders and behind you: the white feathered pair on
// the heaven side of the line, the red bat pair on the hell side. They ride
// the SDK's canonical torso frame (fitted to your two shoulders: their width,
// roll and turn), so they sit on your back rather than float with your head,
// and the portrait mask hides them wherever you are.
import { BodyTracker, CanonicalTorsoFrame } from "@vincentt-xr/sdk/tracking";

import { WINGS } from "./outfit";
import { Part } from "./Part";

/**
 * Where the wings' roots go, in torso centimetres (origin between the
 * shoulder joints, +Y up, +Z toward the camera): a little below the shoulder
 * line and behind the back. The files put their roots 12.5 cm below and
 * 25 cm behind the face; `scale` sizes the pair.
 */
const MOUNT = { y: -3, z: -9, scale: 0.85 };
const ROOT = { y: -12.5, z: -25 };

export const Wings = () => (
  <BodyTracker bodyIndex={0}>
    <CanonicalTorsoFrame smoothing={0.35}>
      <group
        name="split-wings"
        scale={100 * MOUNT.scale}
        position={[
          0,
          MOUNT.y - ROOT.y * MOUNT.scale,
          MOUNT.z - ROOT.z * MOUNT.scale,
        ]}
      >
        {WINGS.map((p) => (
          <Part key={p.id} part={p} />
        ))}
      </group>
    </CanonicalTorsoFrame>
  </BodyTracker>
);
