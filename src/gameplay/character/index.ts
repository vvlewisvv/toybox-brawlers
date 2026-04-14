export type {
  AttackFrameTimings,
  AttackTimings,
  CharacterDefinition,
  CharacterVisualIdentity,
  CharacterVisuals,
  FighterAnimationStyle,
  FighterMeshMotionStyle,
  FighterTuning,
  HitboxShape,
  JumpArc,
  MovementTuning,
  StrikePreset,
  CharacterVitals,
} from './types'
export {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_FIGHTER_ANIMATION,
  DEFAULT_FIGHTER_TUNING,
  DEFAULT_HITBOX_SHAPES,
  DEFAULT_JUMP_ARC,
  DEFAULT_MESH_MOTION_STYLE,
  DEFAULT_MOVEMENT,
  type ResolvedCharacterRuntime,
  type ResolvedCombatNumbers,
  type ResolvedVisualIdentity,
  resolveCharacterRuntime,
} from './defaults'
export type { AttackFramesByKind } from '../combat/attackTimeline'
export { CHARACTER_BIBI } from './bibi'
export { CHARACTER_EMBERCLAW } from './emberclaw'
export { CHARACTER_BRAMBLE } from './bramble'
export { CHARACTER_CHOMP } from './chomp'
export { CHARACTER_GLOOM } from './gloom'
export { CHARACTER_PLACEHOLDER_BOT, CHARACTER_PLACEHOLDER_DEFAULT } from './characterPresets'
export {
  applyProceduralVisualSizing,
  getModelRelativeScale,
  logModelScale,
  MODEL_RELATIVE_SCALE,
  REFERENCE_VISUAL_HEIGHT,
  resolveGlbVisualScale,
} from './characterVisualSizing'
export {
  GLB_FIGHTER_IMPORT_OVERRIDES,
  getGlbFighterImportOverrides,
  type GlbFighterImportOverrides,
} from './glbFighterImportConfig'
export {
  DEFAULT_ROSTER_TEST_P1_ID,
  DEFAULT_ROSTER_TEST_P2_ID,
  getRosterTestDefinition,
  type CharacterSelectPresenter,
  rosterEntriesToSelectPresenters,
  type RosterTestEntry,
  ROSTER_TEST_ENTRIES,
} from './rosterTest'
