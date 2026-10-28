// The two worlds behind you, and the light each throws on you. The camera
// picture is drawn just above App.tsx's VideoBackground (GROUNDING.md, camera
// effects) and split twice: by the portrait mask (the room is replaced, you
// stay) and by the line (heaven on the left, hell on the right, blended
// softly across it).
//   Heaven: a white-gold sky with a sun glowing from the top corner, light
//   rays fanning from it, and soft clouds drifting past, a sea of them below.
//   Hell: deep red-black, a fire glow rising from below behind jagged rocks,
//   smoke curling up, the whole of it wavering in the heat.
//   On you: a warm golden light on the heaven side; on the hell side a
//   darker, redder grade with a red rim light along your outline.
// Until the mask is ready, the whole picture is the two worlds.
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Texture } from "three";
import { usePersonMaskTexture } from "@vincentt-xr/sdk";
import { useXRCameraTexture } from "@vincentt-xr/sdk/low-level";

import { glideSplit, shared, split } from "./split";

const LOOK = {
  /** Heaven sky: top, low, and the sun's warm glow (top-left corner). */
  skyTop: [0.6, 0.71, 0.9] as const,
  skyLow: [0.98, 0.84, 0.62] as const,
  sun: [1.0, 0.82, 0.45] as const,
  /** Hell: top, the glow from below, and the fire's hottest colour. */
  hellTop: [0.035, 0.005, 0.01] as const,
  hellLow: [0.55, 0.06, 0.02] as const,
  fire: [1.0, 0.42, 0.08] as const,
  /** The light on you: warm gold (heaven), red rim (hell). */
  gold: [1.0, 0.82, 0.45] as const,
  rim: [1.0, 0.12, 0.04] as const,
  /** How soft the blend across the line is (screen heights either side). */
  blend: 0.012,
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D cameraTexture;
  uniform sampler2D maskTexture;
  uniform float hasMask;
  uniform vec2 texel;
  uniform float aspect;
  uniform float time;
  uniform float splitX;
  uniform float blend;
  uniform vec3 skyTop;
  uniform vec3 skyLow;
  uniform vec3 sunColor;
  uniform vec3 hellTop;
  uniform vec3 hellLow;
  uniform vec3 fireColor;
  uniform vec3 gold;
  uniform vec3 rimColor;
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
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // The mask blurred over a ring of the given radius (mask texels).
  float ring(vec2 uv, float r) {
    float m = 0.0;
    for (int i = 0; i < 10; i++) {
      float a = float(i) * 0.6283;
      m += texture2D(maskTexture, uv + vec2(cos(a), sin(a)) * texel * r).g;
    }
    return m * 0.1;
  }

  // You, softened: the mask and a small ring, then a smooth step.
  float person(vec2 uv) {
    if (hasMask < 0.5) return 0.0;
    float m = texture2D(maskTexture, uv).g * 0.3 + ring(uv, 3.0) * 0.7;
    return smoothstep(0.45, 0.85, m);
  }

  vec3 heaven(vec2 p, vec2 uv) {
    // Sky: soft blue up high, warming to cream and gold lower down.
    vec3 c = mix(skyLow, skyTop, smoothstep(0.05, 1.0, uv.y));
    // The sun, just off the top-left corner.
    vec2 sun = vec2(-0.05, 1.08);
    vec2 d = p - sun;
    float r = length(d);
    c += sunColor * (exp(-r * 3.2) * 0.55 + exp(-r * 12.0) * 0.5);
    // Rays fanning out from it, slowly turning and breathing.
    float ang = atan(d.y, d.x);
    float rays = noise(vec2(ang * 9.0 + time * 0.05, time * 0.08)) * 0.6
      + noise(vec2(ang * 23.0 - time * 0.07, 3.0)) * 0.4;
    rays = smoothstep(0.5, 0.9, rays) * exp(-r * 0.8) * smoothstep(0.05, 0.3, r);
    // Clouds drifting past: wisps up high, a soft sea of them below,
    // lit gold on the sun side, lilac in their shade.
    vec2 q = vec2(p.x * 1.2 + time * 0.012, p.y * 2.4) * 2.2;
    float cl = fbm(q);
    float low = smoothstep(0.5, 0.0, uv.y);
    float cover = smoothstep(0.5 - low * 0.25, 0.78 - low * 0.2, cl + low * 0.3);
    float lit = clamp(0.55 + (cl - fbm(q + vec2(0.06, 0.1))) * 5.0, 0.0, 1.0);
    vec3 cloud = mix(vec3(0.76, 0.74, 0.86), vec3(1.0, 0.95, 0.84), lit);
    c = mix(c, cloud, cover * 0.9);
    // The rays fall across everything, clouds included.
    c += vec3(1.0, 0.93, 0.72) * rays * 0.4;
    return c;
  }

  vec3 hell(vec2 p, vec2 uv) {
    // Heat shimmer: everything wavers, more near the fire below.
    float heat = smoothstep(0.9, 0.0, uv.y);
    vec2 w = vec2(
      noise(vec2(p.x * 9.0, p.y * 14.0 - time * 2.2)) - 0.5,
      noise(vec2(p.x * 11.0 + 5.0, p.y * 12.0 - time * 1.8)) - 0.5
    ) * 0.018 * (0.4 + heat);
    vec2 s = p + w;
    vec3 c = mix(hellLow, hellTop, smoothstep(0.0, 0.85, uv.y + w.y));
    // Smoke curling up, lit red from below.
    float smoke = fbm(vec2(s.x * 2.4, s.y * 1.8 - time * 0.09));
    c += hellLow * smoothstep(0.4, 0.9, smoke) * (0.35 + heat * 0.5);
    // Fire glow along the bottom, flickering.
    float flame = fbm(vec2(s.x * 4.0, s.y * 3.0 - time * 0.55));
    float glow = smoothstep(0.55, 0.0, uv.y + (flame - 0.5) * 0.25);
    c += fireColor * glow * glow * (0.55 + 0.3 * flame);
    // Jagged rocks against the glow.
    float rocks = 0.1 + 0.07 * fbm(vec2(s.x * 3.0, 1.0))
      + 0.05 * noise(vec2(s.x * 14.0, 4.0));
    float rock = smoothstep(rocks + 0.004, rocks - 0.004, uv.y);
    c = mix(c, vec3(0.05, 0.01, 0.01) + fireColor * 0.06 * (1.0 - uv.y * 4.0), rock);
    // Dark corners.
    vec2 v = (uv - 0.5) * vec2(1.1, 0.8);
    c *= mix(0.55, 1.0, smoothstep(0.75, 0.25, length(v)));
    return c;
  }

  void main() {
    vec3 cam = texture2D(cameraTexture, vUv).rgb;
    vec2 p = vec2(vUv.x * aspect, vUv.y);
    // 0 on the heaven side, 1 on the hell side, soft across the line.
    float side = smoothstep(-blend, blend, (vUv.x - splitX) * aspect);

    vec3 room = mix(heaven(p, vUv), hell(p, vUv), side);

    float m = person(vUv);
    // How near your outline a point on you is (0 deep inside, 1 at the edge).
    float edge = hasMask > 0.5
      ? clamp(1.0 - smoothstep(0.55, 0.98, ring(vUv, 14.0)), 0.0, 1.0)
      : 0.0;
    // A green backdrop's spill along your outline, taken out (only strong
    // greens near the edge, so a green top keeps its colour).
    float spill = smoothstep(0.06, 0.16, cam.g - max(cam.r, cam.b));
    cam.g = mix(cam.g, max(cam.r, cam.b), spill * clamp(edge * 1.5, 0.0, 1.0));
    float l = dot(cam, vec3(0.299, 0.587, 0.114));

    // Heaven side: warm, golden, softly lifted, brighter toward the sun.
    float toSun = smoothstep(1.4, 0.2, length(p - vec2(-0.05, 1.08)));
    vec3 angel = cam * mix(vec3(1.08), gold * 1.3, 0.5)
      + gold * (0.06 + 0.12 * toSun)
      + vec3(1.0, 0.92, 0.75) * edge * 0.22;
    // Hell side: darker, red-cast and contrasty, with a red rim light and
    // the fire's glow from below.
    vec3 dark = mix(vec3(l), cam, 0.8) * vec3(0.9, 0.62, 0.58);
    dark = pow(dark, vec3(1.12));
    vec3 devil = dark
      + rimColor * edge * edge * 1.1
      + fireColor * cam * smoothstep(0.6, 0.0, vUv.y) * 0.35;

    vec3 you = mix(angel, devil, side);
    gl_FragColor = vec4(mix(room, you, m), 1.0);
  }
`;

const rgb = (c: readonly [number, number, number]) => [...c];

export const World = () => {
  const cameraTexture = useXRCameraTexture();
  const { texture: maskTexture } = usePersonMaskTexture();
  const uniforms = useMemo(
    () => ({
      cameraTexture: { value: null as unknown },
      maskTexture: { value: null as unknown },
      hasMask: { value: 0 },
      texel: { value: [1 / 256, 1 / 256] },
      aspect: { value: 9 / 16 },
      time: { value: 0 },
      splitX: shared.split,
      blend: { value: LOOK.blend },
      skyTop: { value: rgb(LOOK.skyTop) },
      skyLow: { value: rgb(LOOK.skyLow) },
      sunColor: { value: rgb(LOOK.sun) },
      hellTop: { value: rgb(LOOK.hellTop) },
      hellLow: { value: rgb(LOOK.hellLow) },
      fireColor: { value: rgb(LOOK.fire) },
      gold: { value: rgb(LOOK.gold) },
      rimColor: { value: rgb(LOOK.rim) },
    }),
    [],
  );
  // First of the frame: the line and the shared mask are current before
  // anything reads them.
  useFrame((state, dt) => {
    split.x = glideSplit(split.x, split.target, dt);
    shared.split.value = split.x;
    shared.mask.value = (maskTexture as Texture | null) ?? null;
    state.gl.getDrawingBufferSize(shared.size.value);
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.aspect.value = state.size.width / Math.max(1, state.size.height);
    const img = (maskTexture as { image?: { width?: number; height?: number } })
      ?.image;
    if (img?.width && img.height)
      uniforms.texel.value = [1 / img.width, 1 / img.height];
  }, -2);
  if (!cameraTexture) return null; // tracker / media startup and source swaps
  uniforms.cameraTexture.value = cameraTexture;
  uniforms.maskTexture.value = maskTexture ?? null;
  uniforms.hasMask.value = maskTexture ? 1 : 0;
  return (
    <mesh name="split-world" renderOrder={-998} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};
