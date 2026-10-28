// Dev only: ← / → move the line a step, 0 sends it back to the middle, O
// holds the mouth open (or lets it go: the fangs show more);
// window.__split is the line itself (`x` drawn now, `target` where it is
// gliding to; set `target` to move it).
// Scene.tsx lazy-imports this behind an inline NODE_ENV check, so it never
// reaches production.
import { useEffect } from "react";

import { live } from "./live";
import { clampSplit, split, SPLIT } from "./split";

const DevKeys = () => {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__split = split;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")
        split.target = clampSplit(split.target - SPLIT.step);
      else if (e.key === "ArrowRight")
        split.target = clampSplit(split.target + SPLIT.step);
      else if (e.key === "0") split.target = SPLIT.centre;
      else if (e.key === "o")
        live.override = live.override ? null : { jawOpen: 1 };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
};

export default DevKeys;
