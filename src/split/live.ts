// Live face readings, written every frame (no re-renders).
export const live = {
  /** The face's blendshapes, eased (the pieces' face triggers read them). */
  blendshapes: {} as Readonly<Record<string, number | undefined>>,
  /** Dev only (O key): stands in for the face's readings. */
  override: null as Readonly<Record<string, number | undefined>> | null,
};
