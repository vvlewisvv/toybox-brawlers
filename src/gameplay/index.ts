export {
  createFighter,
  createPlaceholderFighter,
  type FighterHealth,
  type FighterTuning,
  type HitPresentationMeta,
  type JumpArc,
  type MovementTuning,
  type PlanarPosition,
  type PlaceholderFighter,
  type StrikeOutcome,
} from './fighterController'
export {
  CHARACTER_BIBI,
  CHARACTER_BRAMBLE,
  CHARACTER_CHOMP,
  CHARACTER_EMBERCLAW,
  CHARACTER_GLOOM,
  CHARACTER_PLACEHOLDER_BOT,
  CHARACTER_PLACEHOLDER_DEFAULT,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_JUMP_ARC,
  DEFAULT_MOVEMENT,
  DEFAULT_ROSTER_TEST_P1_ID,
  DEFAULT_ROSTER_TEST_P2_ID,
  getRosterTestDefinition,
  type CharacterSelectPresenter,
  type CharacterDefinition,
  type CharacterVitals,
  type CharacterVisualIdentity,
  type CharacterVisuals,
  type HitboxShape,
  type RosterTestEntry,
  rosterEntriesToSelectPresenters,
  ROSTER_TEST_ENTRIES,
  type StrikePreset,
  resolveCharacterRuntime,
  type ResolvedCharacterRuntime,
  type ResolvedVisualIdentity,
} from './character'
export type { AttackKind, AttackPhase, AttackState } from './combat'
export { COMBAT_TUNING } from './combat/combatTuning'
export {
  computeFighterCollisionVolumes,
  type FighterCollisionVolumes,
} from './combat'
export {
  resolveStrike,
  type StrikeResolveResult,
} from './combat/hitResolution'
export {
  arcadeBotTuning,
  type ArcadeBotAiPhase,
  type ArcadeBotDebugSnapshot,
  type ArcadeBotTuning,
  COMBAT_TEST_BOT_ALLOW_RUNTIME_TOGGLE,
  COMBAT_TEST_BOT_ENABLED,
  createCombatTestBotFrameSource,
  getArcadeBotDebugSnapshot,
  initArcadeBotDebugFromUrl,
  isCombatTestBotActive,
  toggleCombatTestBotRuntime,
} from './combatTestBot'
export { FIGHT_PLANE_Z, snapRootToFightingPlane } from './fightingPlane'
export { resolvePushboxPair, type PushboxParticipant } from './pushbox'
export {
  GROUND_CONTACT_EPS,
  GROUND_SURFACE_Y,
  resolveFeetOnGroundPlane,
  type GroundResolveResult,
} from './groundPlane'
