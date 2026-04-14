/**
 * 2D pushboxes on the fighting line (X only). Centers use the same logical X as movement.
 */

export type PushboxParticipant = {
  getPlanarX(): number
  getPushHalfX(): number
  shiftPlanarX(delta: number): void
}

/**
 * Separate two fighters along X when push intervals overlap. Runs a few passes so stage
 * clamps can redistribute overlap if one side hits `xLimit`.
 */
export function resolvePushboxPair(
  a: PushboxParticipant,
  b: PushboxParticipant,
  iterations = 4,
): void {
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
    a.shiftPlanarX(-dir * overlap * 0.5)
    b.shiftPlanarX(dir * overlap * 0.5)
  }
}
