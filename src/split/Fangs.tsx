// Devil fangs, made in code (fangShape.ts): two sharp, slightly curved fangs
// hanging from the upper lip near its corners, and a smaller pair rising from
// the lower lip, inside them. Each is pinned to the live face mesh at a lip
// landmark (read from the SDK's FaceRig every frame), so the upper pair
// rides the upper lip and the lower pair rides the jaw as the mouth opens;
// sizes are face centimetres, so they scale with the face. Glossy bone over a deep red root,
// the tips glowing faintly like embers. Hell side only, clipped by the line.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshPhysicalMaterial, type Group } from "three";
import { FaceRig, useFaceRig } from "@vincentt-xr/sdk/face-effects";

import { fangGeometry, type FangShape } from "./fangShape";
import { keepToSide } from "./split";

/** Drawn before the head occluder (−1), so it never hides them. */
const ORDER = -2;

const UPPER: Omit<FangShape, "curl"> = {
  length: 1.15,
  radius: 0.24,
  hook: 0.18,
  down: true,
};
const LOWER: Omit<FangShape, "curl"> = {
  length: 0.62,
  radius: 0.16,
  hook: 0.12,
  down: false,
};
/** How far each tip curls in toward the middle of the mouth. */
const CURL = 0.2;

/**
 * Lip landmarks (MediaPipe's own sides, never swapped): the inner edge of
 * the upper lip near its corners, and of the lower lip a little inside them.
 * The first of each pair is the person's right (canonical −x).
 */
const PINS = {
  upper: [80, 310],
  lower: [178, 402],
} as const;

/** A little out of the skin, so they sit over the lips. */
const OUT = 0.12;

const material = () => {
  const m = new MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.38,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.45,
  });
  m.onBeforeCompile = (shader) => {
    /* eslint-disable no-param-reassign */
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      "attribute float tip;\nvarying float vTip;\nvoid main() {\nvTip = tip;",
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vTip;\nvoid main() {")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n" +
          "totalEmissiveRadiance += vec3(1.0, 0.3, 0.05) * smoothstep(0.62, 1.0, vTip) * 2.2;",
      );
    /* eslint-enable no-param-reassign */
  };
  m.customProgramCacheKey = () => "devil-fang";
  keepToSide(m, "devil");
  return m;
};

/** The four fangs, each moved every frame onto its lip landmark. */
const LipFangs = () => {
  const rig = useFaceRig();
  const mat = useMemo(material, []);
  // In the rig's frame the middle of the mouth is x = 0: the first of each
  // pair sits at −x, so its tip curls toward +x, and the other way round.
  const fangs = useMemo(
    () => [
      { at: PINS.upper[0], g: fangGeometry({ ...UPPER, curl: CURL }) },
      { at: PINS.upper[1], g: fangGeometry({ ...UPPER, curl: -CURL }) },
      { at: PINS.lower[0], g: fangGeometry({ ...LOWER, curl: CURL }) },
      { at: PINS.lower[1], g: fangGeometry({ ...LOWER, curl: -CURL }) },
    ],
    [],
  );
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const view = rig?.current.view;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const k = fangs[i].at * 3;
      const ok =
        !!view && Number.isFinite(view[k]) && Number.isFinite(view[k + 2]);
      // eslint-disable-next-line no-param-reassign
      g.visible = ok;
      if (ok && view) g.position.set(view[k], view[k + 1], view[k + 2] + OUT);
    });
  });
  return (
    <>
      {fangs.map((f, i) => (
        <group
          key={f.at}
          ref={(g) => {
            refs.current[i] = g;
          }}
        >
          <mesh
            name={`fang-${f.at}`}
            geometry={f.g}
            material={mat}
            renderOrder={ORDER}
            frustumCulled={false}
          />
        </group>
      ))}
    </>
  );
};

export const Fangs = () => (
  // One face rig: canonical centimetres on the live face.
  <FaceRig>
    <LipFangs />
  </FaceRig>
);
