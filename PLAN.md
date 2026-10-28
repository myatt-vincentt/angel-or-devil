# Plan — Angel or Devil

A soft glowing line splits the picture, and you, in half: half angel, half devil. Built on SDK
2.0.0-alpha.9 with the vincentt.studio head accessories. Front camera, one player.

## Design

- The line runs top to bottom: gold on the heaven side, fading to red on the hell side, with a
  bright thread and drifting sparks. It is fainter where it crosses you.
- Left of the line is heaven: a white-gold sky, the sun in the top corner, light rays, soft
  clouds and drifting white feathers. A warm golden light falls on your skin. You wear a golden
  halo and a white feathered wing.
- Right of the line is hell: deep red-black, a fire glow behind jagged rocks, smoke, rising
  embers, everything wavering in the heat. A red rim light runs along your outline. You wear a
  red horn, the dark half of the halo, devil fangs and a red bat wing.
- Tilt your head toward a side and that side grows across you (lean toward heaven, more of you
  is angel). A small dead zone keeps wobbles still; about 25° reaches an extreme; upright, the
  line drifts back to the middle.
- Hold a full tilt about a second and that side takes over: the line sweeps off the edge with a
  burst (heaven: a white-gold flash and a puff of feathers; hell: a flame flare and a burst of
  embers). Straighten up and the line comes back.
- Taps: a tap grows the side you tap, like leaning toward it; a double tap recentres it.
- Hint: at the start, a small ghost head on a glass disc tilts side to side, the rim warming gold
  or red. It goes for good after your first real tilt. No text.
- Both outfits are worn at once and each is clipped to its own side, so moving the line changes
  how much of you is which. Everything follows the line: backgrounds, lights, particles and the
  pieces you wear.

## How it works

- `src/split/split.ts`: the line (0 = left edge, 1 = right edge), its glide, and `keepToSide`,
  which clips any material to its side of the line (and, for things behind you, out of the
  portrait mask).
- `World.tsx`: one full-screen pass over the camera picture: both worlds behind you, both
  lights on you, split by the portrait mask and blended softly across the line.
- `Particles.tsx`: feathers and embers in screen space, behind you. `Seam.tsx`: the line itself,
  on top of everything.
- `FilteredHead.tsx` + `Part.tsx`: the head pieces on the SDK's canonical head fit, steadied by
  a spring, with the head occluder; the models' own face triggers play too (`rig.ts`). The
  filtered head also reports its tilt on screen.
- `tilt.sim.ts` (unit-tested) + `Control.tsx`: tilt, takeovers and taps → where the line goes.
  `Burst.tsx`: the takeover bursts. `TiltHint.tsx`: the hint.
- `Fangs.tsx` + `fangShape.ts`: the devil fangs, made in code, placed every frame on lip
  landmarks from the SDK's face rig (upper pair on the upper lip, lower pair on the jaw).
- `Wings.tsx`: the wings on the SDK's canonical torso frame (fitted to the shoulders), hidden
  behind you by a smoothed portrait mask. They follow only part of the shoulders' turn, stop
  growing once the shoulders fill more than about half the picture, and each folds toward its
  root as it turns edge-on (`Part.tsx`).
- Dev only: ← / → nudge the line, 0 recentres it, [ / ] fake a head tilt in 5° steps, \ lets
  go of it, O holds the mouth open for the models' face triggers; `window.__split` is the line
  (`x`, `target`, `roll`, `takeover`, and `fakeRoll` to fake a tilt).
