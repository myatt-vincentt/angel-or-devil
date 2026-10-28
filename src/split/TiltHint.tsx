// The only hint, wordless: at the start, a small ghost head (the SDK's
// FaceExpressionHint) on a glass disc near the bottom of the picture tilts
// side to side, and the disc's rim warms gold as it leans toward heaven and
// red toward hell. It fades away for good after your first real tilt.
// Motion: strict ease-out, never an overshoot.
import { useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Color, Vector3, type Group, type MeshBasicMaterial } from "three";
// eslint-disable-next-line import/extensions
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
// eslint-disable-next-line import/extensions
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FaceExpressionHint } from "@vincentt-xr/sdk/instructions";

import { control } from "./Control";
import { live } from "./live";

const HINT = {
  /** Where on screen (−1…1, y up), and how far in front of the camera. */
  at: [0, -0.6] as const,
  distance: 1.5,
  /** Disc radius and the ghost's height (scene units at that distance). */
  radius: 0.12,
  height: 0.15,
  /** Seconds after a face first shows before it appears. */
  delay: 0.8,
  /** How far the ghost tilts (radians). */
  tilt: 0.38,
  renderOrder: 1500,
};

const FACE_URL = "/models/face-v1.glb";
/** Night glass (the camera UI's glass) and its edge. */
const GLASS = new Color(35 / 255, 37 / 255, 40 / 255);
const EDGE = new Color(0.92, 0.96, 0.99);
const GOLD = new Color(1, 0.8, 0.35);
const RED = new Color(1, 0.2, 0.08);

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/**
 * The ghost's tilt through one loop (seconds → radians, + leans left): out
 * to the left, hold, back, out to the right, hold, back; each move eases out.
 */
const LOOP: [number, number][] = [
  [0.7, 1],
  [0.5, 1],
  [0.6, 0],
  [0.3, 0],
  [0.7, -1],
  [0.5, -1],
  [0.6, 0],
  [0.3, 0],
];
const LOOP_SECONDS = LOOP.reduce((s, [d]) => s + d, 0);
export const hintTilt = (t: number) => {
  let rest = t % LOOP_SECONDS;
  let from = 0;
  for (let i = 0; i < LOOP.length; i += 1) {
    const [d, to] = LOOP[i];
    if (rest < d) return (from + (to - from) * easeOut(rest / d)) * HINT.tilt;
    rest -= d;
    from = to;
  }
  return 0;
};

export const TiltHint = () => {
  const face = useLoader(GLTFLoader, FACE_URL, (l) =>
    l.setMeshoptDecoder(MeshoptDecoder),
  );
  const camera = useThree((s) => s.camera);
  const root = useRef<Group>(null);
  const ghost = useRef<Group>(null);
  const disc = useRef<MeshBasicMaterial>(null);
  const rim = useRef<MeshBasicMaterial>(null);
  const v = useMemo(() => new Vector3(), []);
  const state = useMemo(() => ({ seen: -1, gone: -1 }), []);

  useFrame(() => {
    const g = root.current;
    if (!g || !ghost.current || !disc.current || !rim.current) return;
    const now = performance.now() / 1000;
    if (state.seen < 0 && live.roll !== null) state.seen = now;
    if (control.tilted && state.gone < 0) state.gone = now;
    const shown =
      state.seen < 0 ? 0 : easeOut((now - state.seen - HINT.delay) / 0.4);
    const left = state.gone < 0 ? 1 : 1 - easeOut((now - state.gone) / 0.5);
    const k = Math.min(shown, left);
    g.visible = k > 0.001;
    if (!g.visible) return;
    // Pinned to its place on screen, just in front of the camera.
    v.set(HINT.at[0], HINT.at[1], 0.5).unproject(camera).sub(camera.position);
    g.position
      .copy(camera.position)
      .addScaledVector(v.normalize(), HINT.distance);
    g.quaternion.copy(camera.quaternion);
    g.scale.setScalar(0.85 + 0.15 * k);
    const a = hintTilt(now - state.seen);
    ghost.current.rotation.z = a;
    disc.current.opacity = 0.64 * k;
    const lean = Math.abs(a) / HINT.tilt;
    rim.current.color.copy(EDGE).lerp(a > 0 ? GOLD : RED, lean * 0.85);
    rim.current.opacity = (0.22 + 0.5 * lean) * k;
  });

  return (
    <group ref={root} name="split-hint" visible={false}>
      <mesh renderOrder={HINT.renderOrder} frustumCulled={false}>
        <circleGeometry args={[HINT.radius, 48]} />
        <meshBasicMaterial
          ref={disc}
          color={GLASS}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={HINT.renderOrder + 1} frustumCulled={false}>
        <ringGeometry args={[HINT.radius * 0.97, HINT.radius, 64]} />
        <meshBasicMaterial
          ref={rim}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Tilts about its neck, near the bottom of the disc. */}
      <group position={[0, -HINT.radius * 0.55, 0.02]}>
        <group ref={ghost}>
          <group position={[0, HINT.radius * 0.55, 0]}>
            <FaceExpressionHint
              expression="smile"
              model={face.scene}
              height={HINT.height}
              orbit={0}
              renderOrder={HINT.renderOrder + 2}
            />
          </group>
        </group>
      </group>
    </group>
  );
};
