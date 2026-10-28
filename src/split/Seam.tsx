// The line itself, over everything: a soft glowing seam, gold on the heaven
// side fading to red on the hell side, with a bright thread down its middle
// and sparks of light drifting along it. Fainter where it crosses you, so
// your face still reads through it.
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending } from "three";

import { shared } from "./split";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, -0.999, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float time;
  uniform float aspect;
  uniform float splitX;
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

  void main() {
    // Distance from the line in screen heights, with a gentle wave.
    float wave = (noise(vec2(vUv.y * 6.0, time * 0.4)) - 0.5) * 0.004;
    float dx = (vUv.x - splitX) * aspect + wave;
    float ad = abs(dx);
    float on = hasMask > 0.5 ? texture2D(personMask, vUv).g : 0.0;
    // A bright thread, a soft glow, and a wide haze.
    float thread = exp(-ad / 0.0016);
    float glow = exp(-ad / 0.012) * 0.55;
    float haze = exp(-ad / 0.05) * 0.18;
    // Light flowing along it: brighter knots drifting (up on both sides).
    float flow = noise(vec2(vUv.y * 18.0 - time * 1.2, 2.0));
    float sparks = smoothstep(0.7, 1.0, noise(vec2(vUv.y * 60.0 - time * 3.0,
      floor(dx / 0.006)))) * exp(-ad / 0.008);
    float k = thread * (0.8 + 0.4 * flow) + glow * (0.7 + 0.5 * flow) + haze
      + sparks * 0.8;
    k *= mix(1.0, 0.5, on);
    // Gold on the heaven side, red on the hell side, white-hot in the middle.
    vec3 gold = vec3(1.0, 0.78, 0.32);
    vec3 red = vec3(1.0, 0.16, 0.06);
    vec3 col = mix(gold, red, smoothstep(-0.02, 0.02, dx));
    col = mix(col, vec3(1.0, 0.95, 0.85), thread * 0.8);
    gl_FragColor = vec4(col * k, 1.0);
  }
`;

export const Seam = () => {
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      aspect: { value: 9 / 16 },
      splitX: shared.split,
      personMask: shared.mask,
      hasMask: { value: 0 },
    }),
    [],
  );
  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.aspect.value = state.size.width / Math.max(1, state.size.height);
    uniforms.hasMask.value = shared.mask.value ? 1 : 0;
  });
  return (
    <mesh name="split-seam" renderOrder={1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};
