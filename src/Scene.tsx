// Scene.tsx — Angel or Devil: a soft glowing line splits the picture, and
// you, in half: heaven and a halo on one side, hell and horns on the other.
// See PLAN.md.
import { lazy, Suspense } from "react";

import { SplitScene } from "./split/SplitScene";

// Dev-only helpers for previewing without a camera. Lazy and behind a
// constant esbuild folds to false in production. Two rules:
// `process.env.NODE_ENV`, not `import.meta.env.DEV` (vincentt-xr/v2-template#112);
// and write the check INSIDE the ternary — hoisted into a `const`, esbuild
// keeps the dead branch.
const DevMediaSwitcher =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevMediaSwitcher"))
    : null;
const DevKeys =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./split/DevKeys"))
    : null;

export const Scene = () => (
  <>
    <SplitScene />
    {DevMediaSwitcher && DevKeys ? (
      <Suspense fallback={null}>
        <DevMediaSwitcher />
        <DevKeys />
      </Suspense>
    ) : null}
  </>
);
