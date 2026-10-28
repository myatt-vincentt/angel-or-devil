// Angel or Devil: a soft glowing line splits the picture, and you, in half.
// Left of it is heaven (a white-gold sky, light rays, drifting feathers, a
// warm golden light on you, a halo and a white wing); right of it is hell
// (a red-black glow, rising embers, heat shimmer, a red rim light on you,
// a horn, a dark halo, a fang and a bat wing). Every piece reads the same line
// (split.ts), so when it moves, the whole picture follows.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
// eslint-disable-next-line import/extensions
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useFaceInfo } from "@vincentt-xr/sdk/tracking";

import { FACE_FPS, FilteredHead } from "./FilteredHead";
import { live } from "./live";
import { FRAME, HEAD } from "./outfit";
import { Part } from "./Part";
import { Particles } from "./Particles";
import { Seam } from "./Seam";
import { Wings } from "./Wings";
import { World } from "./World";

/** The blendshapes the pieces' face triggers read (see rig.ts). */
const FACE_INPUTS = ["jawOpen", "mouthSmileLeft", "mouthSmileRight"];
/** Per-second easing of the readings (higher = snappier, noisier). */
const FACE_EASE = 14;

/** Copies the face's blendshapes, eased, into `live`. */
const FaceSignals = () => {
  // Same options as FilteredHead's FaceTracker: the first consumer of the
  // shared face model sets its face count and rate.
  const face = useFaceInfo({ active: true, numFaces: 1, targetFps: FACE_FPS });
  const raw = useRef<Readonly<Record<string, number | undefined>>>({});
  raw.current = face?.blendshapes ?? {};
  const smooth = useRef<Record<string, number>>({});
  useFrame((_st, dt) => {
    const k = 1 - Math.exp(-FACE_EASE * Math.min(dt, 0.1));
    const out = smooth.current;
    FACE_INPUTS.forEach((name) => {
      const v = raw.current[name] ?? 0;
      out[name] = (out[name] ?? v) + (v - (out[name] ?? v)) * k;
    });
    live.blendshapes = out;
  }, -1);
  return null;
};

/** Soft studio reflections, so the horns' gloss and the halos read on camera. */
const useStudioLight = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const before = scene.environment;
    scene.environment = tex;
    return () => {
      scene.environment = before;
      tex.dispose();
    };
  }, [gl, scene]);
};

export const SplitScene = () => {
  useStudioLight();
  return (
    <>
      <World />
      <Particles />
      {/* Heaven's sun from the top left, hell's fire from the lower right. */}
      <directionalLight
        name="split-sun"
        position={[-4, 5, 3]}
        intensity={0.9}
        color="#ffe2a6"
      />
      <directionalLight
        name="split-fire"
        position={[4, -3, 2]}
        intensity={0.9}
        color="#ff4a1c"
      />
      <Wings />
      <FaceSignals />
      <FilteredHead>
        <group
          name="split-head-frame"
          scale={FRAME.scale}
          position={FRAME.position}
        >
          {HEAD.map((p) => (
            <Part key={p.id} part={p} />
          ))}
        </group>
      </FilteredHead>
      <Seam />
    </>
  );
};
