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
  red horn, the dark half of the halo, a devil fang and a red bat wing.
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
  a spring, with the head occluder. The fangs follow the open mouth (the model's face triggers,
  `rig.ts`).
- `Wings.tsx`: the wings on the SDK's canonical torso frame (fitted to the shoulders), hidden
  behind you by the portrait mask.
- Dev only: ← / → move the line, 0 recentres it, O holds the mouth open; `window.__split` is
  the line.

## Next

Step 2: tilting the head pushes the line across you.
