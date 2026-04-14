import { Box3 } from 'three'
import type { PlaceholderFighterMesh } from '../../rendering/placeholderFighterMesh'

/**
 * After normalization, every fighter’s mesh AABB height is this (world units), then multiplied by {@link MODEL_RELATIVE_SCALE}.
 * GLB layout overrides (yaw / foot Y nudge): `glbFighterImportConfig.ts`. Import pipeline: `glbFighterPipeline.ts`.
 */
export const REFERENCE_VISUAL_HEIGHT = 2

export const MODEL_RELATIVE_SCALE: Record<string, number> = {
  bramble: 1.0,
  emberclaw: 0.9,
  chomp: 0.85,
  bibi: 0.65,
  gloom: 0.5,
  placeholder_default: 0.87,
  placeholder_bot_blue: 0.87,
}

/** `Box3` from `setFromObject` — height along world Y (same as `getSize().y` for axis-aligned boxes). */
export function boxWorldHeightY(box: Box3): number {
  return Math.max(0, box.max.y - box.min.y)
}

export function getModelRelativeScale(characterId: string): number {
  return MODEL_RELATIVE_SCALE[characterId] ?? 1.0
}

function isBox3(v: number | Box3): v is Box3 {
  return typeof v === 'object' && v !== null && 'min' in v && 'max' in v
}

/**
 * `height = box.max.y - box.min.y`, `normalizeScale = REFERENCE_VISUAL_HEIGHT / height`,
 * `scale = normalizeScale * MODEL_RELATIVE_SCALE[id]`.
 */
export function resolveGlbVisualScale(
  intrinsicHeightOrBox: number | Box3,
  characterId: string,
): {
  scale: number
  effectiveHeight: number
  relative: number
  uniform: number
  visualsY: number
  height: number
} {
  const height = isBox3(intrinsicHeightOrBox)
    ? boxWorldHeightY(intrinsicHeightOrBox)
    : intrinsicHeightOrBox

  const relative = getModelRelativeScale(characterId)
  const visualsY = 0
  const effectiveHeight = REFERENCE_VISUAL_HEIGHT * relative

  if (height < 1e-5) {
    return {
      scale: relative,
      effectiveHeight,
      relative,
      uniform: 1,
      visualsY,
      height,
    }
  }

  const uniform = REFERENCE_VISUAL_HEIGHT / height
  return {
    scale: uniform * relative,
    effectiveHeight,
    relative,
    uniform,
    visualsY,
    height,
  }
}

export function logModelScale(
  fighterId: string,
  scaleScalar: number,
  effectiveHeight: number,
  kind: 'glb' | 'procedural',
  intrinsicHeight?: number,
  extra?: { relative?: number; uniform?: number },
): void {
  const rel = extra?.relative !== undefined ? ` relative=${extra.relative.toFixed(2)}` : ''
  const un = extra?.uniform !== undefined ? ` uniform=${extra.uniform.toFixed(4)}` : ''
  console.info(
    `[MODEL_SCALE] fighter=${fighterId} scale=${scaleScalar.toFixed(4)} effectiveHeight=${effectiveHeight.toFixed(3)} intrinsic=${intrinsicHeight !== undefined ? intrinsicHeight.toFixed(4) : 'n/a'}${rel}${un} kind=${kind}`,
  )
}

/**
 * Uniform scale on `visuals` once: same normalize × {@link MODEL_RELATIVE_SCALE} as GLB path.
 */
export function applyProceduralVisualSizing(
  assets: PlaceholderFighterMesh,
  fighterId: string,
): void {
  assets.visuals.updateMatrixWorld(true)
  const box = new Box3().setFromObject(assets.visuals)
  const height = boxWorldHeightY(box)

  const { scale, effectiveHeight, relative, uniform, visualsY } = resolveGlbVisualScale(height, fighterId)

  if (height < 1e-5) {
    logModelScale(fighterId, scale, effectiveHeight, 'procedural', height, { relative, uniform })
    return
  }

  assets.visuals.scale.setScalar(scale)
  if (visualsY !== 0) assets.visuals.position.y += visualsY

  assets.visuals.updateMatrixWorld(true)
  const b2 = new Box3().setFromObject(assets.visuals)
  assets.standHalfHeight = Math.max(0.05, -b2.min.y)

  logModelScale(fighterId, scale, effectiveHeight, 'procedural', height, { relative, uniform })
}
