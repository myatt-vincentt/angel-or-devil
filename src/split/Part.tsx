// One worn piece: loaded once (shared cache), cloned, recoloured by swapping
// to the file's own materials for the chosen preset, showing only the file's
// default look (scenes[0].extras.vincentt_config closures), playing the loops
// its author marked autoplay, following its face triggers (rig.ts), kept to
// its side of the line, and popping in about its own middle.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AnimationMixer,
  Box3,
  LoopRepeat,
  Quaternion,
  Vector3,
  type AnimationClip,
  type Group,
  type Material,
  type Color,
  type Mesh,
  type Object3D,
} from "three";
// eslint-disable-next-line import/extensions
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
// eslint-disable-next-line import/extensions
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  defineGltfAsset,
  useXRAsset,
  type XRAssetDefinition,
} from "@vincentt-xr/sdk";

import { live } from "./live";
import { modelUrl, type Part as PartSpec } from "./outfit";
import { buildRig, type FaceTrigger } from "./rig";
import { keepToSide } from "./split";

const assets = new Map<string, XRAssetDefinition<GLTF>>();
export const assetFor = (id: string) => {
  let a = assets.get(id);
  if (!a) {
    a = defineGltfAsset(modelUrl(id));
    assets.set(id, a);
  }
  return a;
};

type ClipConfig = { clip: string; loop?: boolean; autoplay?: boolean };
type ItemConfig = {
  presets?: { name?: string; finish?: string }[];
  finishes?: { id: string; map?: Record<string, string> }[];
  animations?: ClipConfig[];
  rig?: { autoplay?: boolean };
  closures?: { id: string; show?: string[] }[];
  closure_default?: string | null;
  closure_nodes?: string[];
  face_triggers?: FaceTrigger[];
};

/** Clips that loop while worn. */
const autoplayClips = (cfg: ItemConfig, clips: AnimationClip[]) => {
  if (cfg.animations?.length)
    return cfg.animations
      .filter((a) => a.autoplay)
      .map((a) => clips.find((c) => c.name === a.clip))
      .filter((c): c is AnimationClip => !!c);
  return cfg.rig?.autoplay ? clips : [];
};

/** The optional looks the file carries that its default look leaves out. */
const hiddenLooks = (cfg: ItemConfig) => {
  const show = new Set(
    cfg.closures?.find((c) => c.id === cfg.closure_default)?.show ?? [],
  );
  return new Set((cfg.closure_nodes ?? []).filter((n) => !show.has(n)));
};

/** Mesh renderOrder: opaque / see-through (the head occluder is -1). */
export const ORDER = [5, 6] as const;

/** `Silver Moon` → `silver_moon`: how a preset names its material variants. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/**
 * The swaps a part gets: its preset's finish, then the preset's colour
 * variant of each material that has one.
 */
const swapsFor = (cfg: ItemConfig, part: PartSpec, names: string[]) => {
  const preset =
    cfg.presets?.find((p) => p.name === part.preset) ?? cfg.presets?.[0];
  const finish = cfg.finishes?.find((f) => f.id === preset?.finish)?.map ?? {};
  const variant: Record<string, string> = {};
  if (part.preset) {
    const have = new Set(names);
    const tag = `__${slug(part.preset)}`;
    names.forEach((n) => {
      if (!n.includes("__") && have.has(n + tag)) variant[n] = n + tag;
    });
  }
  return { ...finish, ...variant };
};

const materialNames = (value: GLTF) =>
  ((value.parser.json.materials ?? []) as { name?: string }[]).map(
    (d) => d.name ?? "",
  );

const prepare = (
  root: Object3D,
  cfg: ItemConfig,
  swaps: Record<string, string>,
  spare: Map<string, Material>,
  part: PartSpec,
) => {
  const hidden = hiddenLooks(cfg);
  // Each part gets its own copies: the line's clip is per material.
  const own = new Map<Material, Material>();
  const copy = (m: Material) => {
    let c = own.get(m);
    if (!c) {
      c = m.clone();
      // By the file's own zone name, whichever variant the preset picked.
      const base = m.name.split("__")[0];
      const tint = part.colors?.[base];
      if (tint) (c as Material & { color?: Color }).color?.set(tint);
      const glow = part.glow?.[base];
      if (glow) (c as Material & { emissive?: Color }).emissive?.set(glow);
      keepToSide(c, part.side, part.behindPerson);
      own.set(m, c);
    }
    return c;
  };
  root.traverse((o) => {
    // The finish swatches only preview a file's finishes in its editor.
    if (o.name.includes("finish_swatch") || hidden.has(o.name)) {
      // eslint-disable-next-line no-param-reassign
      o.visible = false;
      return;
    }
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    if (Array.isArray(m.material)) m.material = m.material.map(copy);
    else {
      const to = spare.get(swaps[m.material.name]);
      m.material = copy(to ?? m.material);
    }
    const mats = (
      Array.isArray(m.material) ? m.material : [m.material]
    ) as Material[];
    const clear = mats.some((x) => x.transparent);
    m.renderOrder = clear ? ORDER[1] : ORDER[0];
    if (clear)
      mats.forEach((x) => {
        // eslint-disable-next-line no-param-reassign
        x.depthWrite = false;
      });
  });
  return root;
};

const POP = 0.3; // s

/**
 * Edge-on folding: how squarely a wing faces the camera (|cos|) where it
 * starts to fold, and where it is fully open; and how fast it follows.
 */
const EDGE_ON = [0.25, 0.6] as const;
const EDGE_EASE = 8;
const edgeQ = new Quaternion();
const edgeP = new Vector3();
const edgeN = new Vector3();
const edgeV = new Vector3();
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** House motion: strict ease-out, never an overshoot. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * The spare materials a part swaps to: in the file but on no mesh, so the
 * loader never built them — load them by name.
 */
const useSpareMaterials = (value: GLTF | null | undefined, part: PartSpec) => {
  const [spare, setSpare] = useState<Map<string, Material> | null>(null);
  useEffect(() => {
    if (!value) return undefined;
    let alive = true;
    const cfg = (value.scene.userData?.vincentt_config ?? {}) as ItemConfig;
    const want = new Set(
      Object.values(swapsFor(cfg, part, materialNames(value))),
    );
    const defs = (value.parser.json.materials ?? []) as { name?: string }[];
    const idx = defs
      .map((d, i) => [d.name, i] as const)
      .filter(([n]) => n && want.has(n));
    Promise.all(
      idx.map(([n, i]) =>
        value.parser
          .getDependency("material", i)
          .then((m: Material) => [n as string, m] as const),
      ),
    )
      .then((pairs) => {
        if (alive) setSpare(new Map(pairs));
      })
      .catch(() => {
        if (alive) setSpare(new Map());
      });
    return () => {
      alive = false;
    };
  }, [value, part]);
  return spare;
};

export const Part = ({ part }: { part: PartSpec }) => {
  const { value } = useXRAsset(assetFor(part.id));
  const spare = useSpareMaterials(value, part);
  const holder = useRef<Group>(null);
  const born = useRef(-1);

  const model = useMemo(() => {
    if (!value || !spare) return null;
    const cfg = (value.scene.userData?.vincentt_config ?? {}) as ItemConfig;
    const root = prepare(
      cloneSkinned(value.scene),
      cfg,
      swapsFor(cfg, part, materialNames(value)),
      spare,
      part,
    );
    const mixer = new AnimationMixer(root);
    autoplayClips(cfg, value.animations).forEach((c) =>
      mixer.clipAction(c).setLoop(LoopRepeat, Infinity).play(),
    );
    const centre = new Box3().setFromObject(root).getCenter(new Vector3());
    const rig = buildRig(
      root,
      cfg.face_triggers ?? [],
      mixer,
      value.animations,
    );
    // Wings that fold away when they turn edge-on (see `edgeOn`).
    const edges = (part.edgeOn ?? [])
      .map((n) => root.getObjectByName(n))
      .filter((o): o is Object3D => !!o)
      .map((bone) => ({ bone, base: bone.scale.clone(), k: 1 }));
    return { root, centre, mixer, rig, edges };
  }, [value, spare, part]);

  useEffect(
    () => () => {
      model?.mixer.stopAllAction();
    },
    [model],
  );

  useFrame((state, dt) => {
    if (!model || !holder.current) return;
    model.rig(live.override ?? live.blendshapes);
    model.mixer.update(Math.min(dt, 0.1));
    // A wing seen edge-on is a hard white sliver: it folds toward its root
    // as it turns away from the camera, and opens again as it turns back.
    model.edges.forEach((e) => {
      e.bone.getWorldQuaternion(edgeQ);
      e.bone.getWorldPosition(edgeP);
      const facing = Math.abs(
        edgeN
          .set(0, 0, 1)
          .applyQuaternion(edgeQ)
          .dot(edgeV.copy(state.camera.position).sub(edgeP).normalize()),
      );
      const want = smoothstep(EDGE_ON[0], EDGE_ON[1], facing);
      e.k += (want - e.k) * (1 - Math.exp(-EDGE_EASE * Math.min(dt, 0.1)));
      e.bone.scale.copy(e.base).multiplyScalar(Math.max(1e-3, e.k));
    });
    const now = state.clock.elapsedTime;
    if (born.current < 0) born.current = now;
    const k = Math.min(1, (now - born.current) / POP);
    const size = 0.6 + 0.4 * easeOut(k);
    const f = part.fit;
    holder.current.scale.setScalar(size * (f?.scale ?? 1));
    holder.current.position.set(
      model.centre.x + (f?.x ?? 0) / 100,
      model.centre.y + (f?.y ?? 0) / 100,
      model.centre.z + (f?.z ?? 0) / 100,
    );
  });

  if (!model) return null;
  return (
    <group ref={holder} name={`split-${part.id}`} scale={0.6}>
      <group position={model.centre.clone().negate()}>
        <primitive object={model.root} />
      </group>
    </group>
  );
};
