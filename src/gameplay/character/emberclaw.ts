import { createEmberclawGlbMesh } from '../../rendering/emberclawGlbMesh'
import type { CharacterDefinition } from './types'

/**
 * Meshy Crimson Ember Dragon: base `public/models/emberclaw.glb` + `emberclaw-*.glb` animation clips (see `emberclawGlbMesh.ts`).
 * Red dragon specialist: readable normals, explosive special — big damage and stun if it lands, long whiff penalty.
 * Design target + select portrait: `docs/reference/emberclaw-design-target.png`, `public/characters/emberclaw-portrait.png`.
 */
export const CHARACTER_EMBERCLAW: CharacterDefinition = {
  id: 'emberclaw',
  displayName: 'Emberclaw',
  movement: {
    walkSpeed: 4.88,
    crouchSpeedFactor: 0.4,
    airControl: 0.53,
    pushHalfX: 0.41,
  },
  jump: {
    jumpVelocity: 9.05,
    gravity: 31.8,
  },
  vitals: { maxHp: 102 },
  strikes: {
    light: {
      timings: {
        startup: 0.068,
        active: 0.044,
        recoveryOnConnect: 0.1,
        recoveryOnWhiff: 0.17,
      },
      hitbox: { reach: 0.45, halfX: 0.27, halfY: 0.36, halfZ: 0.19 },
      damage: 5,
      hitStun: 0.15,
    },
    heavy: {
      timings: {
        startup: 0.13,
        active: 0.068,
        recoveryOnConnect: 0.15,
        recoveryOnWhiff: 0.29,
      },
      hitbox: { reach: 0.55, halfX: 0.31, halfY: 0.42, halfZ: 0.21 },
      damage: 11,
      hitStun: 0.25,
      blockStunDefender: 0.16,
      blockStunAttacker: 0.085,
    },
    special: {
      timings: {
        startup: 0.23,
        active: 0.092,
        recoveryOnConnect: 0.22,
        recoveryOnWhiff: 0.48,
      },
      hitbox: {
        reach: 0.62,
        halfX: 0.35,
        halfY: 0.46,
        halfZ: 0.26,
      },
      damage: 27,
      hitStun: 0.44,
      blockStunDefender: 0.26,
      blockStunAttacker: 0.16,
    },
  },
  visuals: {
    identity: { shortName: 'EMBER', accentColor: 0xe85a28 },
    meshMotion: {
      crouchScaleY: 0.54,
      attackScale: {
        startup: { x: 1.05, z: 1.04 },
        active: { x: 1.16, z: 1.14 },
        recovery: { x: 1.04, z: 1.03 },
      },
      emissive: {
        active: [0.95, 0.32, 0.06],
        startup: [0.45, 0.12, 0.04],
        block: [0.2, 0.28, 0.45],
      },
    },
  },
  createMesh: () => createEmberclawGlbMesh(),
}
