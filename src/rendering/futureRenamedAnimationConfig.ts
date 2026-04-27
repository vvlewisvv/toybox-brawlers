/**
 * Future animation import convention (not wired yet).
 *
 * Keep base fighter visuals on each fighter's existing base model.
 * Animation GLBs should be clip sources only in a later pass.
 */
export const FUTURE_ANIMATION_STATE_KEYS = [
  'idle',
  'walk',
  'run',
  'attack_light',
  'attack_medium',
  'attack_heavy',
  'block',
  'hit',
  'ko',
] as const

export type FutureAnimationStateKey = (typeof FUTURE_ANIMATION_STATE_KEYS)[number]

const FUTURE_FILE_SUFFIX_BY_STATE: Record<FutureAnimationStateKey, string> = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  attack_light: 'AttackLight',
  attack_medium: 'AttackMedium',
  attack_heavy: 'AttackHeavy',
  block: 'Block',
  hit: 'Hit',
  ko: 'KO',
}

export function buildFutureAnimationFilePath(
  characterName: string,
  state: FutureAnimationStateKey,
  folder = `/models/${characterName}`,
): string {
  return `${folder}/${characterName}-${FUTURE_FILE_SUFFIX_BY_STATE[state]}.glb`
}
