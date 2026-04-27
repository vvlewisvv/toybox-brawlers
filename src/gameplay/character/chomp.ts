import { createChompGlbMesh } from '../../rendering/chompGlbMesh'
import type { CharacterDefinition } from './types'

/**
 * Meshy Giggles the Green Dino: base `public/models/chomp.glb` + `chomp-*.glb` clips (see `chompGlbMesh.ts`).
 * Green dinosaur grappler-pressure: fast stubby lights, chunky heavies, special reads like a telegraphed scoop / command grab.
 * (Still strike-based; no throw OS — long startup, huge close box, big payoffs.)
 * Design target + select portrait: `docs/reference/chomp-design-target.png`, `public/characters/chomp-portrait.png`.
 */
export const CHARACTER_CHOMP: CharacterDefinition = {
  id: 'chomp',
  displayName: 'Chomp',
  movement: {
    walkSpeed: 4.35,
    crouchSpeedFactor: 0.4,
    airControl: 0.5,
    pushHalfX: 0.43,
  },
  jump: {
    jumpVelocity: 8.35,
    gravity: 32.5,
  },
  vitals: { maxHp: 112 },
  strikes: {
    light: {
      timings: {
        startup: 0.06,
        active: 0.044,
        recoveryOnConnect: 0.09,
        recoveryOnWhiff: 0.15,
      },
      hitbox: {
        reach: 0.33,
        halfX: 0.34,
        halfY: 0.4,
        halfZ: 0.22,
      },
      damage: 5,
      hitStun: 0.15,
      blockStunDefender: 0.11,
      blockStunAttacker: 0.045,
    },
    heavy: {
      timings: {
        startup: 0.135,
        active: 0.066,
        recoveryOnConnect: 0.16,
        recoveryOnWhiff: 0.284,
      },
      hitbox: {
        reach: 0.43,
        halfX: 0.33,
        halfY: 0.44,
        halfZ: 0.24,
      },
      damage: 12,
      hitStun: 0.27,
      blockStunDefender: 0.17,
      blockStunAttacker: 0.095,
    },
    special: {
      timings: {
        startup: 0.32,
        active: 0.098,
        recoveryOnConnect: 0.25,
        recoveryOnWhiff: 0.46,
      },
      hitbox: {
        reach: 0.34,
        halfX: 0.4,
        halfY: 0.56,
        halfZ: 0.3,
      },
      damage: 22,
      hitStun: 0.48,
      blockStunDefender: 0.32,
      blockStunAttacker: 0.18,
    },
  },
  visuals: {
    identity: { shortName: 'CHOMP', accentColor: 0x3fa068 },
    meshMotion: {
      crouchScaleY: 0.52,
      attackScale: {
        startup: { x: 1.04, z: 1.03 },
        active: { x: 1.14, z: 1.12 },
        recovery: { x: 1.06, z: 1.04 },
      },
      emissive: {
        active: [0.12, 0.28, 0.14],
        startup: [0.06, 0.16, 0.1],
        block: [0.08, 0.2, 0.22],
      },
    },
  },
  createMesh: () => createChompGlbMesh(),
}
