import {
  isRosterGlbFighterId,
  probeRequiredRosterGlbUrls,
  preloadAllRosterGlbBoot,
  preloadAllRosterGlbCombat,
  preloadRosterGlbRoundEnd,
  ROSTER_GLB_FIGHTER_IDS,
} from '../rendering/rosterGlbStageCache'

export { ROSTER_GLB_FIGHTER_IDS }

/** Avoid importing gameplay graph from assets; fighters match this shape at runtime. */
export type AssetPipelineFighter = {
  getCharacterId(): string
  mesh: { importedGlbAnim?: { rescanAnimationClips?: () => void } }
}

export type CharacterSelectAssetMode = 'vs-bot' | 'online'

let getActiveFighters: () => readonly (AssetPipelineFighter | undefined)[] = () => []

/**
 * Lets the pipeline rescan GLB mixers after staged clip loads (fighters created at boot).
 */
export function setActiveFightersForAssetPipeline(
  getter: () => readonly (AssetPipelineFighter | undefined)[],
): void {
  getActiveFighters = getter
}

function rescanActiveGlbFighters(): void {
  for (const f of getActiveFighters()) {
    if (!f) continue
    if (!isRosterGlbFighterId(f.getCharacterId())) continue
    f.mesh.importedGlbAnim?.rescanAnimationClips?.()
  }
}

/**
 * Stage 1 — app boot: roster rig + idle preview only (no combat / KO / win split GLBs).
 */
export async function loadBootAssets(): Promise<void> {
  console.info('[assets] boot stage start')
  await probeRequiredRosterGlbUrls()
  await preloadAllRosterGlbBoot()
  rescanActiveGlbFighters()
  console.info('[assets] boot stage done')
}

/**
 * Stage 2 — character select / lobby setup: full combat clip set for the whole roster (background).
 */
export async function loadCharacterSelectAssets(mode: CharacterSelectAssetMode): Promise<void> {
  console.info('[assets] character select stage start', { mode })
  await preloadAllRosterGlbCombat()
  rescanActiveGlbFighters()
  console.info('[assets] character select stage done', { mode })
}

/**
 * Stage 3 — round about to start: KO + win clips for the two fighters in this match only.
 */
export async function loadRoundStartAssets(fighterIds: readonly string[]): Promise<void> {
  const unique = [...new Set(fighterIds)].filter(isRosterGlbFighterId)
  console.info('[assets] round start stage start (KO / win only)', { fighterIds: unique })
  await Promise.all(unique.map((id) => preloadRosterGlbRoundEnd(id)))
  rescanActiveGlbFighters()
  console.info('[assets] round start stage done (KO / win only)', { fighterIds: unique })
}

/**
 * Countdown / fight gate: guarantees Stage 2 is complete for the roster, then Stage 3 for `fighterIds`.
 * Safe if the player skipped long on character select (combat load may still be in flight).
 */
export async function ensureMatchGlbAssetsReady(fighterIds: readonly string[]): Promise<void> {
  console.info('[assets] pre-round · ensuring combat GLBs (full roster)')
  await preloadAllRosterGlbCombat()
  rescanActiveGlbFighters()
  await loadRoundStartAssets(fighterIds)
}

/** @internal Dev / tests: full eager load equivalent to legacy single-shot preload. */
export async function loadFullRosterGlbForTests(): Promise<void> {
  await preloadAllRosterGlbBoot()
  await preloadAllRosterGlbCombat()
  await Promise.all(ROSTER_GLB_FIGHTER_IDS.map((id) => preloadRosterGlbRoundEnd(id)))
  rescanActiveGlbFighters()
}
