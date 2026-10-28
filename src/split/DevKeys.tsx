// Dev only: ← / → nudge the line a step, 0 recentres it (and lets go of a
// fake tilt), [ / ] fake a head tilt toward the left / right in 5° steps
// (hold one past 25° for a second to see a takeover), \ lets go of the fake
// tilt, O holds the mouth open (or lets it go). window.__split is the line:
// `x` drawn now, `target`, `roll` (the tilt in use), `takeover`, and
// `fakeRoll` (set a number of degrees to fake a tilt, null to let go);
// window.__scene is the three.js scene, for inspecting.
// Scene.tsx lazy-imports this behind an inline NODE_ENV check, so it never
// reaches production.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { control } from "./Control";
import { live } from "./live";
import { split, SPLIT } from "./split";

const FAKE_STEP = 5;

const DevKeys = () => {
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__split = split;
    (window as unknown as Record<string, unknown>).__scene = scene;
    const nudge = (d: number) => {
      control.nudge = Math.max(-0.4, Math.min(0.4, control.nudge + d));
    };
    const fake = (d: number) => {
      split.fakeRoll = Math.max(-40, Math.min(40, (split.fakeRoll ?? 0) + d));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") nudge(-SPLIT.step);
      else if (e.key === "ArrowRight") nudge(SPLIT.step);
      else if (e.key === "0") {
        control.nudge = 0;
        split.fakeRoll = null;
      } else if (e.key === "[") fake(FAKE_STEP);
      else if (e.key === "]") fake(-FAKE_STEP);
      else if (e.key === "\\") split.fakeRoll = null;
      else if (e.key === "o")
        live.override = live.override ? null : { jawOpen: 1 };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene]);
  return null;
};

export default DevKeys;
