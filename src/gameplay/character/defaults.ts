import { COMBAT_TUNING } from '../combat/combatTuning'
import {
  ATTACK_FRAMES,
  type AttackFramesByKind,
  type AttackKind,
} from '../combat/attackTimeline'
import type {
  CharacterDefinition,
  FighterMeshMotionStyle,
  FighterTuning,
  HitboxShape,
  JumpArc,
  MovementTuning,
  StrikePreset,
} from './types'

export const DEFAULT_MOVEMENT: MovementTuning = {
  walkSpeed: 5.2,
  crouchSpeedFactor: 0.42,
  airControl: 0.55,
  xLimit: 7.2,
  pushHalfX: 0.36,
}

export const DEFAULT_JUMP_ARC: JumpArc = {
  /** Slightly softer than “snappy” gravity so arcs hang readable mid-screen. */
  gravity: 28.5,
  jumpVelocity: 9.45,
}

/** Merged defaults for systems that still want a single locomotion blob. */
export const DEFAULT_FIGHTER_TUNING: FighterTuning = {
  ...DEFAULT_MOVEMENT,
  ...DEFAULT_JUMP_ARC,
}

export const DEFAULT_MESH_MOTION_STYLE: FighterMeshMotionStyle = {
  crouchScaleY: 0.58,
  attackScale: {
    startup: { x: 1.05, z: 1.02 },
    active: { x: 1.12, z: 1.08 },
    recovery: { x: 1.03, z: 1.02 },
  },
  emissive: {
    active: [0.24, 0.19, 0.12],
    startup: [0.11, 0.085, 0.055],
    block: [0.05, 0.22, 0.38],
  },
  airReadEmissive: [0.045, 0.11, 0.16],
  koColorMul: 0.48,
}

/** @deprecated Use DEFAULT_MESH_MOTION_STYLE */
export const DEFAULT_FIGHTER_ANIMATION = DEFAULT_MESH_MOTION_STYLE

export const DEFAULT_ACCENT_COLOR = 0xc4a574

/** Baseline strike volumes when `strikes[k].hitbox` is omitted. */
export const DEFAULT_HITBOX_SHAPES: Record<AttackKind, HitboxShape> = {
  light: { reach: 0.44, halfX: 0.26, halfY: 0.36, halfZ: 0.18 },
  heavy: { reach: 0.62, halfX: 0.32, halfY: 0.44, halfZ: 0.2 },
  special: { reach: 0.54, halfX: 0.3, halfY: 0.42, halfZ: 0.22 },
}

export type ResolvedCombatNumbers = {
  maxHp: number
  damage: Record<AttackKind, number>
  hitStun: Record<AttackKind, number>
  blockStunDefender: Record<AttackKind, number>
  blockStunAttacker: Record<AttackKind, number>
}

export type ResolvedVisualIdentity = {
  shortName: string
  accentColor: number
}

export type ResolvedCharacterRuntime = {
  id: string
  displayName: string
  tuning: FighterTuning
  animation: FighterMeshMotionStyle
  attackFrames: AttackFramesByKind
  hitboxes: Record<AttackKind, HitboxShape>
  combat: ResolvedCombatNumbers
  visualIdentity: ResolvedVisualIdentity
}

const ATTACK_KINDS: AttackKind[] = ['light', 'heavy', 'special']

function deriveShortName(displayName: string): string {
  const word = displayName.trim().split(/\s+/)[0]
  if (word.length <= 10) return word.toUpperCase()
  return word.slice(0, 8).toUpperCase() + '…'
}

function mergeMeshMotion(partial?: Partial<FighterMeshMotionStyle>): FighterMeshMotionStyle {
  const d = DEFAULT_MESH_MOTION_STYLE
  if (!partial) return d
  return {
    crouchScaleY: partial.crouchScaleY ?? d.crouchScaleY,
    attackScale: {
      startup: { ...d.attackScale.startup, ...partial.attackScale?.startup },
      active: { ...d.attackScale.active, ...partial.attackScale?.active },
      recovery: { ...d.attackScale.recovery, ...partial.attackScale?.recovery },
    },
    emissive: {
      active: partial.emissive?.active ?? d.emissive.active,
      startup: partial.emissive?.startup ?? d.emissive.startup,
      block: partial.emissive?.block ?? d.emissive.block,
    },
    airReadEmissive: partial.airReadEmissive ?? d.airReadEmissive,
    koColorMul: partial.koColorMul ?? d.koColorMul,
  }
}

function mergeStrikePreset(kind: AttackKind, preset?: StrikePreset): {
  timings: AttackFramesByKind[AttackKind]
  hitbox: HitboxShape
  damage: number
  hitStun: number
  blockStunDefender: number
  blockStunAttacker: number
} {
  const baseF = ATTACK_FRAMES[kind]
  const baseH = DEFAULT_HITBOX_SHAPES[kind]
  const t = preset?.timings
  return {
    timings: {
      startup: t?.startup ?? baseF.startup,
      active: t?.active ?? baseF.active,
      recoveryOnConnect: t?.recoveryOnConnect ?? baseF.recoveryOnConnect,
      recoveryOnWhiff: t?.recoveryOnWhiff ?? baseF.recoveryOnWhiff,
    },
    hitbox: {
      reach: preset?.hitbox?.reach ?? baseH.reach,
      halfX: preset?.hitbox?.halfX ?? baseH.halfX,
      halfY: preset?.hitbox?.halfY ?? baseH.halfY,
      halfZ: preset?.hitbox?.halfZ ?? baseH.halfZ,
    },
    damage: preset?.damage ?? COMBAT_TUNING.damage[kind],
    hitStun: preset?.hitStun ?? COMBAT_TUNING.hitStun[kind],
    blockStunDefender:
      preset?.blockStunDefender ?? COMBAT_TUNING.blockStunDefender[kind],
    blockStunAttacker:
      preset?.blockStunAttacker ?? COMBAT_TUNING.blockStunAttacker[kind],
  }
}

function mergeStrikes(strikes?: CharacterDefinition['strikes']): {
  attackFrames: AttackFramesByKind
  hitboxes: Record<AttackKind, HitboxShape>
  perKindCombat: Omit<ResolvedCombatNumbers, 'maxHp'>
} {
  const attackFrames = {} as AttackFramesByKind
  const hitboxes = {} as Record<AttackKind, HitboxShape>
  const damage = {} as Record<AttackKind, number>
  const hitStun = {} as Record<AttackKind, number>
  const blockStunDefender = {} as Record<AttackKind, number>
  const blockStunAttacker = {} as Record<AttackKind, number>

  for (const k of ATTACK_KINDS) {
    const row = mergeStrikePreset(k, strikes?.[k])
    attackFrames[k] = row.timings
    hitboxes[k] = row.hitbox
    damage[k] = row.damage
    hitStun[k] = row.hitStun
    blockStunDefender[k] = row.blockStunDefender
    blockStunAttacker[k] = row.blockStunAttacker
  }

  return {
    attackFrames,
    hitboxes,
    perKindCombat: { damage, hitStun, blockStunDefender, blockStunAttacker },
  }
}

export function resolveCharacterRuntime(def: CharacterDefinition): ResolvedCharacterRuntime {
  const { attackFrames, hitboxes, perKindCombat } = mergeStrikes(def.strikes)
  const maxHp = def.vitals?.maxHp ?? COMBAT_TUNING.maxHp

  return {
    id: def.id,
    displayName: def.displayName,
    tuning: {
      ...DEFAULT_MOVEMENT,
      ...def.movement,
      ...DEFAULT_JUMP_ARC,
      ...def.jump,
    },
    animation: mergeMeshMotion(def.visuals?.meshMotion),
    attackFrames,
    hitboxes,
    combat: { maxHp, ...perKindCombat },
    visualIdentity: {
      shortName: def.visuals?.identity?.shortName ?? deriveShortName(def.displayName),
      accentColor: def.visuals?.identity?.accentColor ?? DEFAULT_ACCENT_COLOR,
    },
  }
}
