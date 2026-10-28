// The takeover burst, when a side wins (tilt.sim.ts): heaven gives a soft
// white-gold flash from your head and a puff of feathers that floats out and
// drifts down; hell gives a flame flare up from the bottom of the picture and
// a burst of embers flying out and up. In front of everything but the line.
// Everything fades with a strict ease-out.
import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
} from "three";

import { control } from "./Control";
import { live } from "./live";
import { shared } from "./split";
import { SPRITES } from "./sprites";

/** Seconds each part lasts. */
const FLASH = 1.1;
const PUFF = 2.6;

const flashVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, -0.998, 1.0);
  }
`;

const flashFragment = /* glsl */ `
  uniform float age;
  uniform float side;
  uniform vec2 origin;
  uniform float aspect;
  uniform sampler2D personMask;
  uniform float hasMask;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float k = clamp(age / ${FLASH.toFixed(2)}, 0.0, 1.0);
    // Full at once, then a strict ease-out to nothing.
    float fade = pow(1.0 - k, 3.0);
    if (fade <= 0.0) discard;
    vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
    vec2 o = vec2(origin.x * 0.5 * aspect, origin.y * 0.5);
    vec3 col;
    if (side < 0.5) {
      // Heaven: a soft white-gold bloom from the head, warming the picture.
      float d = length(p - o);
      col = vec3(1.0, 0.9, 0.68) * (exp(-d * 3.0) * 0.55 + 0.14);
    } else {
      // Hell: flames leap up from the bottom, then sink back.
      float h = 0.2 + 0.6 * (1.0 - k) * (1.0 - k);
      float f = fbm(vec2(vUv.x * 5.0, vUv.y * 2.5 - age * 3.5));
      float flame = smoothstep(h, h * 0.35, vUv.y - (f - 0.5) * 0.45);
      col = mix(vec3(0.95, 0.1, 0.02), vec3(1.0, 0.7, 0.2), f * f * 1.6)
        * flame * 1.5;
      // And a red glow round the edges.
      col += vec3(0.75, 0.05, 0.0) * smoothstep(0.25, 0.7, length(p)) * 0.8;
    }
    // Lighter over you, so your face stays readable at the peak.
    float on = hasMask > 0.5 ? texture2D(personMask, vUv).g : 0.0;
    col *= mix(1.0, side < 0.5 ? 0.45 : 0.35, on);
    gl_FragColor = vec4(col * fade, 1.0);
  }
`;

const pointsVertex = /* glsl */ `
  attribute vec4 seed;
  uniform float age;
  uniform float side;
  uniform float kind;
  uniform vec2 origin;
  uniform float aspect;
  uniform float pixelRatio;
  varying float vSeed;
  varying float vAngle;
  varying float vFade;
  void main() {
    float dur = kind < 0.5 ? ${PUFF.toFixed(2)} : 1.8;
    float k = clamp(age / dur, 0.0, 1.0);
    float out1 = 1.0 - pow(1.0 - min(1.0, age / (dur * 0.45)), 3.0);
    float a = seed.x * 6.2832;
    float reach = kind < 0.5 ? mix(0.25, 0.8, seed.y) : mix(0.3, 1.2, seed.y);
    vec2 dir = vec2(cos(a) / aspect, sin(a));
    vec2 p = origin + dir * reach * out1;
    // Feathers then drift down, rocking; embers rise and waver.
    p.y += kind < 0.5 ? -age * 0.06 * (0.5 + seed.z) : age * 0.25 * (0.5 + seed.z);
    p.x += kind < 0.5
      ? sin(age * 2.0 + seed.w * 6.2832) * 0.03
      : sin(age * 9.0 + seed.w * 40.0) * 0.01;
    gl_Position = vec4(p, -0.997, 1.0);
    gl_PointSize = (kind < 0.5 ? mix(28.0, 52.0, seed.z) : mix(4.0, 11.0, seed.z))
      * pixelRatio;
    vSeed = seed.w;
    vAngle = seed.w * 6.2832 + sin(age * 2.4 + seed.z * 9.0) * 0.7;
    // Only this side's kind shows.
    vFade = abs(kind - side) > 0.5 ? 0.0 : pow(1.0 - k, 2.0);
  }
`;

const pointsFragment = /* glsl */ `
  uniform float side;
  uniform float kind;
  uniform float age;
  varying float vSeed;
  varying float vAngle;
  varying float vFade;
  ${SPRITES}
  void main() {
    if (vFade <= 0.0) discard;
    vec2 q = gl_PointCoord - 0.5;
    if (kind < 0.5) {
      vec4 f = feather(q, vAngle);
      if (f.a <= 0.01) discard;
      gl_FragColor = vec4(mix(f.rgb, vec3(1.0, 0.92, 0.7), 0.2), f.a * vFade);
    } else {
      vec4 e = ember(q, vSeed, age) * vFade;
      if (e.a <= 0.01) discard;
      gl_FragColor = vec4(e.rgb, 1.0);
    }
  }
`;

const COUNT = { feathers: 26, embers: 110 };

const seeds = (count: number) => {
  const a = new Float32Array(count * 4);
  for (let i = 0; i < a.length; i += 1) a[i] = Math.random();
  return a;
};

const geometry = (count: number) => {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(count * 3), 3),
  );
  g.setAttribute("seed", new BufferAttribute(seeds(count), 4));
  return g;
};

export const Burst = () => {
  const gl = useThree((s) => s.gl);
  const feathers = useMemo(() => geometry(COUNT.feathers), []);
  const embers = useMemo(() => geometry(COUNT.embers), []);
  const u = useMemo(
    () => ({
      age: { value: 100 },
      side: { value: 0 },
      origin: { value: [0, 0.3] },
      aspect: { value: 9 / 16 },
      pixelRatio: { value: 1 },
      personMask: shared.mask,
      hasMask: { value: 0 },
    }),
    [],
  );
  // Feathers (kind 0) and embers (kind 1) share the rest.
  const uf = useMemo(() => ({ ...u, kind: { value: 0 } }), [u]);
  const ue = useMemo(() => ({ ...u, kind: { value: 1 } }), [u]);
  const state = useMemo(() => ({ seen: control.bursts, at: -1 }), []);

  useFrame((st) => {
    const now = performance.now() / 1000;
    if (control.bursts !== state.seen) {
      state.seen = control.bursts;
      state.at = now;
      u.side.value = control.burstSide === "angel" ? 0 : 1;
      u.origin.value = [live.head.x, live.head.y];
    }
    u.age.value = state.at < 0 ? 100 : now - state.at;
    u.aspect.value = st.size.width / Math.max(1, st.size.height);
    u.pixelRatio.value = gl.getPixelRatio();
    u.hasMask.value = shared.mask.value ? 1 : 0;
  });

  return (
    <group name="split-burst">
      <mesh renderOrder={997} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          uniforms={u}
          vertexShader={flashVertex}
          fragmentShader={flashFragment}
          transparent
          blending={AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <points geometry={feathers} renderOrder={998} frustumCulled={false}>
        <shaderMaterial
          uniforms={uf}
          vertexShader={pointsVertex}
          fragmentShader={pointsFragment}
          transparent
          blending={NormalBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <points geometry={embers} renderOrder={998} frustumCulled={false}>
        <shaderMaterial
          uniforms={ue}
          vertexShader={pointsVertex}
          fragmentShader={pointsFragment}
          transparent
          blending={AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
};
