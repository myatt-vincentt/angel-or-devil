// Particles behind you, each kept to its own side of the line: white
// feathers drifting down through heaven, rocking and turning as they fall,
// and embers rising through hell, flickering and wavering in the heat. Drawn
// straight in screen space (one draw call a layer), hidden wherever the
// portrait mask says you are.
import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry } from "three";

import { shared } from "./split";

type Layer = {
  name: string;
  count: number;
  /** Size in CSS px, smallest to largest. */
  size: [number, number];
  /** Screen heights per second, slowest to fastest (+ rises, − falls). */
  speed: [number, number];
  /** Side-to-side drift (screen widths). */
  sway: number;
  alpha: number;
  /** 0 = heaven side (left of the line), 1 = hell side (right of it). */
  side: 0 | 1;
  additive: boolean;
};

const FEATHERS: Layer = {
  name: "split-feathers",
  count: 64,
  size: [24, 46],
  speed: [-0.035, -0.07],
  sway: 0.05,
  alpha: 0.95,
  side: 0,
  additive: false,
};

const EMBERS: Layer = {
  name: "split-embers",
  count: 260,
  size: [3, 9],
  speed: [0.06, 0.16],
  sway: 0.025,
  alpha: 1,
  side: 1,
  additive: true,
};

const vertexShader = /* glsl */ `
  attribute vec4 seed;
  uniform float time;
  uniform vec2 size;
  uniform vec2 speed;
  uniform float sway;
  uniform float pixelRatio;
  uniform float side;
  varying float vSeed;
  varying float vAngle;
  varying float vLife;
  void main() {
    float v = mix(speed.x, speed.y, seed.y);
    // 2.4 screen heights a lap, each starting at its own place.
    float lap = mod(time * abs(v) * 2.0 + seed.z * 2.4, 2.4);
    float y = v > 0.0 ? lap - 1.2 : 1.2 - lap;
    // Spread over the whole picture; the line decides which show.
    float x = seed.x * 2.2 - 1.1;
    x += sin(time * (0.5 + seed.w * 0.8) + seed.w * 6.2832) * sway * 2.0;
    // Embers waver in the heat.
    x += side > 0.5 ? sin(time * 5.0 + seed.z * 40.0) * 0.006 : 0.0;
    gl_Position = vec4(x, y, 0.999, 1.0);
    gl_PointSize = mix(size.x, size.y, seed.y) * pixelRatio;
    vSeed = seed.w;
    // A feather rocks as it falls, and slowly turns.
    vAngle = seed.w * 6.2832 + sin(time * (0.9 + seed.w) + seed.z * 9.0) * 0.6
      + time * 0.15 * (seed.w - 0.5);
    vLife = lap / 2.4;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float alpha;
  uniform float side;
  uniform float time;
  uniform float splitX;
  uniform sampler2D personMask;
  uniform vec2 personMaskSize;
  varying float vSeed;
  varying float vAngle;
  varying float vLife;

  void main() {
    vec2 frag = gl_FragCoord.xy / personMaskSize;
    if ((side < 0.5) == (frag.x > splitX)) discard;
    if (texture2D(personMask, frag).g > 0.5) discard;
    vec2 q = gl_PointCoord - 0.5;
    if (side < 0.5) {
      // A feather: a slim curved vane with a fine quill down the middle.
      float c = cos(vAngle);
      float s = sin(vAngle);
      q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
      q.x += q.y * q.y * 0.5;
      float along = q.y + 0.5;
      float width = 0.2 * sin(clamp(along, 0.0, 1.0) * 3.1416)
        * (0.75 + 0.25 * along);
      float vane = smoothstep(width, width - 0.035, abs(q.x))
        * step(0.05, along) * step(along, 0.98);
      // Barbs: faint diagonal grooves.
      float barbs = 0.88 + 0.12 * sin((abs(q.x) * 1.4 + q.y) * 70.0);
      float quill = smoothstep(0.012, 0.0, abs(q.x)) * step(along, 1.0)
        * step(-0.04, along);
      float a = max(vane, quill * 0.9);
      if (a <= 0.01) discard;
      vec3 col = mix(vec3(1.0, 0.98, 0.94), vec3(0.9, 0.84, 0.72), quill);
      // A soft warm shade along the vane's edge, so it reads on a bright sky.
      col = mix(col, vec3(0.84, 0.76, 0.62),
        smoothstep(width - 0.07, width, abs(q.x)) * 0.8);
      col *= barbs;
      // The ones nearer the sun catch a little gold.
      col = mix(col, vec3(1.0, 0.9, 0.62), 0.25 * frag.y * (1.0 - frag.x));
      gl_FragColor = vec4(col, a * alpha);
    } else {
      // An ember: a hot core with a soft glow, flickering, dying as it rises.
      float d = length(q) * 2.0;
      float flick = 0.6 + 0.4 * sin(time * (9.0 + vSeed * 7.0) + vSeed * 30.0);
      float fade = smoothstep(1.0, 0.55, vLife) * smoothstep(0.0, 0.08, vLife);
      float core = smoothstep(0.45, 0.0, d);
      float glow = smoothstep(1.0, 0.0, d) * 0.5;
      float a = (core + glow) * flick * fade;
      if (a <= 0.01) discard;
      vec3 col = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.8, 0.35), core);
      gl_FragColor = vec4(col * a * alpha, 1.0);
    }
  }
`;

const seeds = (count: number) => {
  const a = new Float32Array(count * 4);
  for (let i = 0; i < a.length; i += 1) a[i] = Math.random();
  return a;
};

const Points = ({ layer }: { layer: Layer }) => {
  const gl = useThree((s) => s.gl);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    // Positions are made in the shader; three still wants one to count.
    g.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(layer.count * 3), 3),
    );
    g.setAttribute("seed", new BufferAttribute(seeds(layer.count), 4));
    return g;
  }, [layer]);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      size: { value: layer.size },
      speed: { value: layer.speed },
      sway: { value: layer.sway },
      alpha: { value: layer.alpha },
      side: { value: layer.side },
      pixelRatio: { value: 1 },
      splitX: shared.split,
      personMask: shared.mask,
      personMaskSize: shared.size,
    }),
    [layer],
  );
  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.pixelRatio.value = gl.getPixelRatio();
  });
  return (
    <points
      name={layer.name}
      geometry={geometry}
      frustumCulled={false}
      renderOrder={-997}
    >
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={layer.additive ? AdditiveBlending : undefined}
        toneMapped={false}
      />
    </points>
  );
};

export const Particles = () => (
  <>
    <Points layer={FEATHERS} />
    <Points layer={EMBERS} />
  </>
);
