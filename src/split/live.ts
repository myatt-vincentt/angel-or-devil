// Live readings, written every frame (no re-renders).
export const live = {
  /** The face's blendshapes, eased (the pieces' face triggers read them). */
  blendshapes: {} as Readonly<Record<string, number | undefined>>,
  /** Dev only (O key): stands in for the face's readings. */
  override: null as Readonly<Record<string, number | undefined>> | null,
  /**
   * The head's tilt on screen in degrees, + when the top of the head leans
   * toward the screen's left; null with no face.
   */
  roll: null as number | null,
  /** The head on screen (−1…1, y up), when there is one. */
  head: { x: 0, y: 0.3 },
};
