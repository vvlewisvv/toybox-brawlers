import { createBibiGlbMesh } from '../../rendering/bibiGlbMesh'
import type { CharacterDefinition } from './types'

/**
 * Small blue bear all-rounder: snappy walk, quick normals, tight recoveries on hit for easy chains.
 * Rig: `public/models/Bibi.glb` + `Bibi-*.glb` clips (see `bibiGlbMesh.ts`).
 * Design target + select portrait: `docs/reference/bibi-design-target.png`, `public/characters/bibi-portrait.png`.
 */
export const CHARACTER_BIBI: CharacterDefinition = {
  id: 'bibi',
  displayName: 'Bibi',
  movement: {
    walkSpeed: 5.78,
    crouchSpeedFactor: 0.46,
    airControl: 0.62,
    pushHalfX: 0.29,
  },
  jump: {
    jumpVelocity: 9.55,
    gravity: 30.5,
  },
  vitals: { maxHp: 98 },
  strikes: {
    light: {
      timings: {
        startup: 0.052,
        active: 0.038,
        recoveryOnConnect: 0.07,
        recoveryOnWhiff: 0.12,
      },
      hitbox: { reach: 0.4, halfX: 0.22, halfY: 0.3, halfZ: 0.16 },
      damage: 4,
      hitStun: 0.14,
      blockStunDefender: 0.085,
      blockStunAttacker: 0.04,
    },
    heavy: {
      timings: {
        startup: 0.11,
        active: 0.06,
        recoveryOnConnect: 0.11,
        recoveryOnWhiff: 0.24,
      },
      hitbox: { reach: 0.52, halfX: 0.28, halfY: 0.38, halfZ: 0.18 },
      damage: 9,
      hitStun: 0.22,
      blockStunDefender: 0.13,
      blockStunAttacker: 0.075,
    },
    special: {
      timings: {
        startup: 0.14,
        active: 0.075,
        recoveryOnConnect: 0.16,
        recoveryOnWhiff: 0.32,
      },
      hitbox: { reach: 0.5, halfX: 0.3, halfY: 0.4, halfZ: 0.2 },
      damage: 13,
      hitStun: 0.28,
      blockStunDefender: 0.16,
      blockStunAttacker: 0.09,
    },
  },
  visuals: {
    identity: { shortName: 'BIBI', accentColor: 0x6eb6e8 },
    meshMotion: {
      crouchScaleY: 0.55,
      attackScale: {
        startup: { x: 1.02, z: 1.02 },
        active: { x: 1.1, z: 1.08 },
        recovery: { x: 1.01, z: 1.01 },
      },
      emissive: {
        active: [0.14, 0.22, 0.34],
        startup: [0.08, 0.12, 0.2],
        block: [0.1, 0.18, 0.32],
      },
    },
  },
  createMesh: () => createBibiGlbMesh(),
}
