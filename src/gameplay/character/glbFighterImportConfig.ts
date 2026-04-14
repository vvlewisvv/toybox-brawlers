/**
 * Per-fighter overrides for rigged GLB imports only (not procedural placeholders).
 * All Meshy exports are expected to share: feet near ground, forward-facing, similar native scale.
 *
 * - {@link MODEL_RELATIVE_SCALE} in `characterVisualSizing.ts` — roster height multipliers (required).
 * - This file — optional facing / vertical tweak after standard normalize + ground snap.
 */
export type GlbFighterImportOverrides = {
  /** Added to the GLB holder `rotation.y` after uniform scale (radians). */
  visualYawOffsetRad?: number
  /** Added to holder world Y after feet grounding (world units). */
  modelYOffset?: number
}

/** Extend when a new export needs a small facing or foot tweak. Defaults = no extra rotation or Y. */
export const GLB_FIGHTER_IMPORT_OVERRIDES: Record<string, GlbFighterImportOverrides> = {}

export function getGlbFighterImportOverrides(fighterId: string): GlbFighterImportOverrides {
  return GLB_FIGHTER_IMPORT_OVERRIDES[fighterId] ?? {}
}
