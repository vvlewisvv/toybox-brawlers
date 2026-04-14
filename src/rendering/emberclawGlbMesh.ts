import type { Object3D } from 'three'
import { createEmberclawDragonMesh } from './emberclawDragonMesh'
import { createRiggedGlbFighterMesh } from './glbFighterPipeline'
import type { PlaceholderFighterMesh } from './placeholderFighterMesh'
import { getRosterGlbClipArray, getRosterGlbTemplate, preloadRosterGlbBoot } from './rosterGlbStageCache'

const FIGHTER_ID = 'emberclaw' as const

export async function preloadEmberclawGlb(): Promise<boolean> {
  return preloadRosterGlbBoot(FIGHTER_ID)
}

export function createEmberclawGlbMesh(): PlaceholderFighterMesh {
  const templateScene: Object3D | null = getRosterGlbTemplate(FIGHTER_ID)
  if (!templateScene) {
    console.warn('[Emberclaw] createEmberclawGlbMesh: no template, procedural fallback')
    return createEmberclawDragonMesh()
  }
  return createRiggedGlbFighterMesh({
    fighterId: FIGHTER_ID,
    holderName: 'EmberclawGlbVisual',
    templateScene,
    mergedAnimations: getRosterGlbClipArray(FIGHTER_ID),
    combatBodyProxyName: 'EmberclawCombatBodyProxy',
    useIdleAlternation: false,
    stagedGlbLoading: true,
  })
}
