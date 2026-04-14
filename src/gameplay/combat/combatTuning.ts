import type { AttackKind } from './attackTimeline'

/**
 * Single place to tune combat feel: damage, stun, and recovery splits.
 */
export const COMBAT_TUNING = {
  maxHp: 100,
  damage: {
    light: 5,
    heavy: 10,
    special: 14,
  } satisfies Record<AttackKind, number>,
  /** Defender lockout after getting hit. */
  hitStun: {
    light: 0.14,
    heavy: 0.24,
    special: 0.32,
  } satisfies Record<AttackKind, number>,
  /** Defender lockout after blocking a strike. */
  blockStunDefender: {
    light: 0.1,
    heavy: 0.15,
    special: 0.2,
  } satisfies Record<AttackKind, number>,
  /** Attacker lockout when their strike is blocked. */
  blockStunAttacker: {
    light: 0.06,
    heavy: 0.09,
    special: 0.12,
  } satisfies Record<AttackKind, number>,
} as const
