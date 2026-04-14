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
    walkSpeed: 4.624,
    crouchSpeedFactor: 0.368,
    airControl: 0.496,
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
      hitbox: { reach: 0.528, halfX: 0.29, halfY: 0.396, halfZ: 0.211 },
      damage: 4,
      hitStun: 0.14,
      blockStunDefender: 0.085,
      blockStunAttacker: 0.04,
    },
    heavy: {
      timings: {
        // Medium attack: deterministic connect window aligned to visual impact.
        // Keep active long enough to avoid frame-skip misses on variable frame times.
        startup: 0.126,
        active: 0.04,
        recoveryOnConnect: 0.129,
        recoveryOnWhiff: 0.289,
      },
      hitbox: { reach: 0.686, halfX: 0.37, halfY: 0.502, halfZ: 0.238 },
      damage: 9,
      hitStun: 0.22,
      blockStunDefender: 0.13,
      blockStunAttacker: 0.075,
    },
    special: {
      timings: {
        // Heavy attack: additional 30% slowdown stacked on previous 30%.
        startup: 0.415,
        active: 0.127,
        recoveryOnConnect: 0.27,
        recoveryOnWhiff: 0.541,
      },
      hitbox: { reach: 0.66, halfX: 0.396, halfY: 0.528, halfZ: 0.264 },
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
