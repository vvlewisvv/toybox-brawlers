/**
 * 2D pushboxes on the fighting line (X only). Centers use the same logical X as movement.
 */

export type PushboxParticipant = {
  getPlanarX(): number
  getPushHalfX(): number
  shiftPlanarX(delta: number): void
}

export type PushboxResolveOptions = {
  /**
   * Intended horizontal movement input this frame: -1..1.
   * Positive means moving toward +X, negative toward -X.
   */
  aMoveIntentX?: number
  bMoveIntentX?: number
}

/**
 * Separate two fighters along X when push intervals overlap. Runs a few passes so stage
 * clamps can redistribute overlap if one side hits `xLimit`.
 */
export function resolvePushboxPair(
  a: PushboxParticipant,
  b: PushboxParticipant,
  iterations = 4,
  options?: PushboxResolveOptions,
): void {
  const intentA = Math.max(-1, Math.min(1, options?.aMoveIntentX ?? 0))
  const intentB = Math.max(-1, Math.min(1, options?.bMoveIntentX ?? 0))
  for (let i = 0; i < iterations; i++) {
    const ax = a.getPlanarX()
    const bx = b.getPlanarX()
    const d = bx - ax
    const minGap = a.getPushHalfX() + b.getPushHalfX()
    if (Math.abs(d) >= minGap - 1e-5) {
      return
    }

    const overlap = minGap - Math.abs(d)
    const dir = Math.sign(d) || 1
    const aTowardB = intentA * dir > 1e-3
    const bTowardA = intentB * dir < -1e-3

    // Prevent passive shove: if only one side is pressing inward, that side gets displaced.
    if (aTowardB && !bTowardA) {
      a.shiftPlanarX(-dir * overlap)
      continue
    }
    if (bTowardA && !aTowardB) {
      b.shiftPlanarX(dir * overlap)
      continue
    }

    // Mutual pressure (or no clear pressure): separate symmetrically.
    a.shiftPlanarX(-dir * overlap * 0.5)
    b.shiftPlanarX(dir * overlap * 0.5)
  }
}
