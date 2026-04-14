/**
 * Infinite XZ ground used by gameplay and the visual arena floor.
 * Keep in sync with the stage floor in `toyboxArena.ts` (via `minimalStageScene.ts`).
 */
export const GROUND_SURFACE_Y = 0

/** Snap range so tiny gravity steps still register as on the floor. */
export const GROUND_CONTACT_EPS = 0.02

export type GroundResolveResult = {
  feetY: number
  velY: number
  grounded: boolean
}

/**
 * Integrate vertical motion against a flat ground. Prevents tunneling when `dt` spikes.
 */
export function resolveFeetOnGroundPlane(
  feetY: number,
  velY: number,
  dt: number,
  surfaceY: number = GROUND_SURFACE_Y,
  eps: number = GROUND_CONTACT_EPS,
): GroundResolveResult {
  const nextFeetY = feetY + velY * dt

  if (nextFeetY < surfaceY) {
    return {
      feetY: surfaceY,
      velY: 0,
      grounded: true,
    }
  }

  if (nextFeetY <= surfaceY + eps && velY <= 0) {
    return {
      feetY: surfaceY,
      velY: 0,
      grounded: true,
    }
  }

  return {
    feetY: nextFeetY,
    velY,
    grounded: false,
  }
}
