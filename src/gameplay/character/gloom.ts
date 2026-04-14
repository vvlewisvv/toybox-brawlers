import { createGloomGlbMesh } from '../../rendering/gloomGlbMesh'
import type { CharacterDefinition } from './types'

/**
 * Meshy Midnight Cat: base `public/models/gloom.glb` + `gloom-*.glb` clips (see `gloomGlbMesh.ts`).
 * Short black cat trickster: very low visual crouch, snappy recoveries, short pokes.
 * Design target + select portrait: `docs/reference/gloom-design-target.png`, `public/characters/gloom-portrait.png`.
 */
export const CHARACTER_GLOOM: CharacterDefinition = {
  id: 'gloom',
  displayName: 'Gloom',
  movement: {
    walkSpeed: 5.72,
    crouchSpeedFactor: 0.52,
    airControl: 0.64,
    pushHalfX: 0.26,
  },
  jump: {
    jumpVelocity: 9.4,
    gravity: 31.2,
  },
  vitals: { maxHp: 92 },
  strikes: {
    light: {
      timings: {
        startup: 0.058,
        active: 0.034,
        recoveryOnConnect: 0.052,
        recoveryOnWhiff: 0.09,
      },
      hitbox: { reach: 0.35, halfX: 0.2, halfY: 0.26, halfZ: 0.15 },
      damage: 3,
      hitStun: 0.15,
      blockStunDefender: 0.07,
      blockStunAttacker: 0.032,
    },
    heavy: {
      timings: {
        startup: 0.11,
        active: 0.048,
        recoveryOnConnect: 0.09,
        recoveryOnWhiff: 0.17,
      },
      hitbox: { reach: 0.46, halfX: 0.26, halfY: 0.34, halfZ: 0.17 },
      damage: 8,
      hitStun: 0.27,
      blockStunDefender: 0.12,
      blockStunAttacker: 0.065,
    },
    special: {
      timings: {
        startup: 0.12,
        active: 0.052,
        recoveryOnConnect: 0.12,
        recoveryOnWhiff: 0.26,
      },
      hitbox: { reach: 0.42, halfX: 0.28, halfY: 0.36, halfZ: 0.19 },
      damage: 11,
      hitStun: 0.34,
      blockStunDefender: 0.14,
      blockStunAttacker: 0.08,
    },
  },
  visuals: {
    identity: { shortName: 'GLOOM', accentColor: 0x9b7bc9 },
    meshMotion: {
      crouchScaleY: 0.42,
      attackScale: {
        startup: { x: 1.01, z: 1.02 },
        active: { x: 1.07, z: 1.06 },
        recovery: { x: 1.0, z: 1.01 },
      },
      emissive: {
        active: [0.22, 0.12, 0.32],
        startup: [0.12, 0.06, 0.18],
        block: [0.14, 0.1, 0.26],
      },
    },
  },
  createMesh: () => createGloomGlbMesh(),
}
