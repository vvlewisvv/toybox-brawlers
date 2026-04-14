import type { AttackKind } from '../combat/attackTimeline'
import type { PlaceholderFighterMesh } from '../../rendering/placeholderFighterMesh'

/** Ground and air horizontal control; arena bounds and push width. */
export type MovementTuning = {
  walkSpeed: number
  crouchSpeedFactor: number
  airControl: number
  xLimit: number
  pushHalfX: number
}

/** Vertical motion parameters (gravity + initial jump impulse shape the arc). */
export type JumpArc = {
  gravity: number
  jumpVelocity: number
}

/** Merged locomotion + jump; used by the shared fighter controller each frame. */
export type FighterTuning = MovementTuning & JumpArc

/** Per-strike phase lengths in seconds. */
export type AttackTimings = {
  startup: number
  active: number
  recoveryOnConnect: number
  recoveryOnWhiff: number
}

/** @deprecated Use AttackTimings */
export type AttackFrameTimings = AttackTimings

/** Axis-aligned strike volume in front of the attacker (reach + half-extents). */
export type HitboxShape = {
  reach: number
  halfX: number
  halfY: number
  halfZ: number
}

/**
 * One attack button’s data: timings, hit volume, and hit/block outcomes.
 * Omit any field to inherit global defaults (COMBAT_TUNING + base frames + default shapes).
 */
export type StrikePreset = {
  timings?: Partial<AttackTimings>
  hitbox?: Partial<HitboxShape>
  damage?: number
  hitStun?: number
  blockStunDefender?: number
  blockStunAttacker?: number
}

export type CharacterVitals = {
  maxHp: number
}

/** Non-mesh presentation: HUD, selectors, VFX hooks. */
export type CharacterVisualIdentity = {
  /** Short tag for health bars / character select (defaults from displayName). */
  shortName?: string
  /** Primary UI accent, 0xRRGGBB. */
  accentColor?: number
}

/**
 * Procedural placeholder “animation” (mesh scale + emissive); swap for skeletal rigs later.
 * Lives under `visuals` on the definition as `meshMotion`.
 */
export type FighterMeshMotionStyle = {
  crouchScaleY: number
  attackScale: {
    startup: { x: number; z: number }
    active: { x: number; z: number }
    recovery: { x: number; z: number }
  }
  emissive: {
    active: readonly [number, number, number]
    startup: readonly [number, number, number]
    block: readonly [number, number, number]
  }
  /** Extra RGB emissive while airborne (jump / anti-air read); blended with strike glow. */
  airReadEmissive: readonly [number, number, number]
  koColorMul: number
}

/** @deprecated Use FighterMeshMotionStyle */
export type FighterAnimationStyle = FighterMeshMotionStyle

export type CharacterVisuals = {
  identity?: Partial<CharacterVisualIdentity>
  /** Placeholder mesh pulse / squash; optional. */
  meshMotion?: Partial<FighterMeshMotionStyle>
}

/**
 * Data-driven roster entry: one shared controller resolves this into runtime tuning.
 */
export type CharacterDefinition = {
  id: string
  displayName: string
  movement?: Partial<MovementTuning>
  jump?: Partial<JumpArc>
  vitals?: Partial<CharacterVitals>
  /** Per attack kind: timings, hitbox, damage, stuns — grouped per button. */
  strikes?: Partial<Record<AttackKind, StrikePreset>>
  visuals?: Partial<CharacterVisuals>
  /** Scene graph + materials; primary visual identity for the fighter in-world. */
  createMesh: () => PlaceholderFighterMesh
}
