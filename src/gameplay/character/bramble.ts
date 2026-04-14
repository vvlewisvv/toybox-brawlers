import { createBrambleGlbMesh } from '../../rendering/brambleGlbMesh'
import type { CharacterDefinition } from './types'

/**
 * Big light-brown bear bruiser: slow, tanky, long heavy/special swings.
 * In-world mesh: `public/models/bramble.glb` + `bramble-*.glb` clips (see `brambleGlbMesh.ts`); procedural fallback if preload fails.
 * Select portrait: `public/characters/bramble-portrait.png`.
 */
export const CHARACTER_BRAMBLE: CharacterDefinition = {
  id: 'bramble',
  displayName: 'Bramble',
  movement: {
    walkSpeed: 4.05,
    crouchSpeedFactor: 0.37,
    airControl: 0.47,
    pushHalfX: 0.45,
  },
  jump: {
    jumpVelocity: 8.05,
    gravity: 33.5,
  },
  vitals: { maxHp: 118 },
  strikes: {
    light: {
      timings: {
        startup: 0.1,
        active: 0.052,
        recoveryOnConnect: 0.12,
        recoveryOnWhiff: 0.22,
      },
      hitbox: { reach: 0.47, halfX: 0.28, halfY: 0.38 },
      damage: 6,
      hitStun: 0.17,
    },
    heavy: {
      timings: {
        startup: 0.17,
        active: 0.082,
        recoveryOnConnect: 0.2,
        recoveryOnWhiff: 0.38,
      },
      hitbox: {
        reach: 0.82,
        halfX: 0.4,
        halfY: 0.52,
        halfZ: 0.27,
      },
      damage: 14,
      hitStun: 0.31,
      blockStunDefender: 0.2,
      blockStunAttacker: 0.11,
    },
    special: {
      timings: {
        startup: 0.22,
        active: 0.1,
        recoveryOnConnect: 0.27,
        recoveryOnWhiff: 0.44,
      },
      hitbox: {
        reach: 0.72,
        halfX: 0.36,
        halfY: 0.5,
        halfZ: 0.25,
      },
      damage: 19,
      hitStun: 0.39,
      blockStunDefender: 0.24,
      blockStunAttacker: 0.14,
    },
  },
  visuals: {
    identity: { shortName: 'BRAMBLE', accentColor: 0xa67d52 },
    meshMotion: {
      attackScale: {
        startup: { x: 1.06, z: 1.02 },
        active: { x: 1.12, z: 1.09 },
        recovery: { x: 1.04, z: 1 },
      },
      emissive: {
        active: [0.24, 0.15, 0.07],
        startup: [0.11, 0.07, 0.04],
        block: [0.06, 0.15, 0.24],
      },
    },
  },
  createMesh: () => createBrambleGlbMesh(),
}
