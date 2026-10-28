// The wings, on your shoulders and behind you: the white feathered pair on
// the heaven side of the line, the red bat pair on the hell side. They ride
// the SDK's canonical torso frame (fitted to your two shoulders: their width,
// roll and turn), so they sit on your back rather than float with your head,
// and the portrait mask hides them wherever you are. They follow only part
// of the shoulders' turn, and each folds away as it turns edge-on (Part.tsx).
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Euler,
  PerspectiveCamera,
  Quaternion,
  Vector3,
  type Group,
} from "three";
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

/**
 * How much of the shoulders' turn the wings follow. The turn is read from
 * the shoulders' depth, which swings a lot close to the camera; followed in
 * full it swung the wings across the body and edge-on.
 */
const KEEP_TURN = 0.35;

/**
 * Close to the camera the shoulders fill the picture and the wings, sized
 * to them, become huge white slabs between you and the line. Past this
 * share of the picture's width, the wings stop growing with the shoulders.
 */
const MAX_SHOULDERS = 0.55;
/** The shoulder joints are 36 torso centimetres apart. */
const SHOULDER_CM = 36;

/**
 * Takes back most of the torso frame's turn (about its own up), and keeps
 * the wings from growing past a close-up's share of the picture.
 */
const Steady = ({ children }: { children: ReactNode }) => {
  const g = useRef<Group>(null);
  const q = useMemo(() => new Quaternion(), []);
  const e = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);
  const at = useMemo(() => new Vector3(), []);
  const size = useMemo(() => new Vector3(), []);
  const k = useRef(1);
  useFrame((state, dt) => {
    const o = g.current;
    if (!o?.parent) return;
    o.parent.getWorldQuaternion(q);
    e.setFromQuaternion(q, "YXZ");
    o.rotation.y = -e.y * (1 - KEEP_TURN);
    // How wide the shoulders are against the picture at their depth.
    const cam = state.camera as PerspectiveCamera;
    o.parent.getWorldPosition(at);
    o.parent.getWorldScale(size);
    const depth = Math.max(0.1, cam.position.distanceTo(at));
    const viewWidth =
      2 * depth * Math.tan(((cam.fov ?? 45) * Math.PI) / 360) * cam.aspect;
    const share = (SHOULDER_CM * size.x) / viewWidth;
    const want = Math.min(1, MAX_SHOULDERS / Math.max(share, 1e-3));
    k.current += (want - k.current) * (1 - Math.exp(-6 * Math.min(dt, 0.1)));
    o.scale.setScalar(k.current);
  });
  return <group ref={g}>{children}</group>;
};

export const Wings = () => (
  <BodyTracker bodyIndex={0}>
    <CanonicalTorsoFrame smoothing={0.35}>
      <Steady>
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
      </Steady>
    </CanonicalTorsoFrame>
  </BodyTracker>
);
