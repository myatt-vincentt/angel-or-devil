// What moves the line: your head tilt (tilt.sim.ts), taps as a fallback, and
// takeovers when a full tilt is held. Runs first each frame, so every layer
// that reads the line sees this frame's.
import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";

import { live } from "./live";
import { glideSplit, shared, split } from "./split";
import { createSplitState, stepSplit, tapSplit } from "./tilt.sim";

/** The controls' state, shared with the dev keys. */
export const control = createSplitState();

export const Control = () => {
  const gl = useThree((s) => s.gl);

  // A tap on the picture nudges the line toward that side.
  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      tapSplit(
        control,
        (e.clientX - r.left) / r.width,
        performance.now() / 1000,
      );
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, [gl]);

  useFrame((_state, dt) => {
    // A fake tilt is dev only (the check folds away in production).
    const roll =
      (process.env.NODE_ENV !== "production" ? split.fakeRoll : null) ??
      live.roll;
    stepSplit(control, roll, performance.now() / 1000);
    split.roll = roll;
    split.takeover = control.takeover;
    split.target = control.target;
    split.x = glideSplit(split.x, control.target, control.glide, dt);
    shared.split.value = split.x;
  }, -3);

  return null;
};
