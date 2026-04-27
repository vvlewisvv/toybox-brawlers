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
  /** Confirmed-hit pause (seconds). Equivalent to per-attack hitPauseMs. */
  hitPause: {
    light: 0.045,
    heavy: 0.075,
    special: 0.1,
  } satisfies Record<AttackKind, number>,
  /** Camera shake amplitude by strike strength. */
  cameraShake: {
    light: 0.026,
    heavy: 0.044,
    special: 0.07,
  } satisfies Record<AttackKind, number>,
  /** Pushback distances (world units) on hit / block. */
  pushback: {
    hit: {
      light: { attacker: 0.014, defender: 0.085 },
      heavy: { attacker: 0.02, defender: 0.11 },
      special: { attacker: 0.028, defender: 0.19 },
    },
    block: {
      light: { attacker: 0, defender: 0 },
      heavy: { attacker: 0, defender: 0 },
      special: { attacker: 0.016, defender: 0.052 },
    },
  } as const satisfies {
    hit: Record<AttackKind, { attacker: number; defender: number }>
    block: Record<AttackKind, { attacker: number; defender: number }>
  },
} as const
