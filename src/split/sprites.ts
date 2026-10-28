// The two particle sprites, as GLSL for point shaders: a white feather and a
// hot ember. `q` is the point's own coordinate, centred (gl_PointCoord − 0.5).
export const SPRITES = /* glsl */ `
  // A feather turned by angle: a slim curved vane with a fine quill down the
  // middle and faint barbs. Returns colour and coverage.
  vec4 feather(vec2 q, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    q.x += q.y * q.y * 0.5;
    float along = q.y + 0.5;
    float width = 0.2 * sin(clamp(along, 0.0, 1.0) * 3.1416)
      * (0.75 + 0.25 * along);
    float vane = smoothstep(width, width - 0.035, abs(q.x))
      * step(0.05, along) * step(along, 0.98);
    float barbs = 0.88 + 0.12 * sin((abs(q.x) * 1.4 + q.y) * 70.0);
    float quill = smoothstep(0.012, 0.0, abs(q.x)) * step(along, 1.0)
      * step(-0.04, along);
    float a = max(vane, quill * 0.9);
    vec3 col = mix(vec3(1.0, 0.98, 0.94), vec3(0.9, 0.84, 0.72), quill);
    // A soft warm shade along the vane's edge, so it reads on a bright sky.
    col = mix(col, vec3(0.84, 0.76, 0.62),
      smoothstep(width - 0.07, width, abs(q.x)) * 0.8);
    return vec4(col * barbs, a);
  }

  // An ember: a hot core with a soft glow, flickering. Returns colour already
  // multiplied by its strength (for additive drawing) and the strength.
  vec4 ember(vec2 q, float seed, float time) {
    float d = length(q) * 2.0;
    float flick = 0.6 + 0.4 * sin(time * (9.0 + seed * 7.0) + seed * 30.0);
    float core = smoothstep(0.45, 0.0, d);
    float glow = smoothstep(1.0, 0.0, d) * 0.5;
    float a = (core + glow) * flick;
    vec3 col = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.8, 0.35), core);
    return vec4(col * a, a);
  }
`;
