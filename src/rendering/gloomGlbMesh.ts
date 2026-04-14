import type { Object3D } from 'three'
import { createGloomCatMesh } from './gloomCatMesh'
import { createRiggedGlbFighterMesh } from './glbFighterPipeline'
import type { PlaceholderFighterMesh } from './placeholderFighterMesh'
import { getRosterGlbClipArray, getRosterGlbTemplate, preloadRosterGlbBoot } from './rosterGlbStageCache'

const FIGHTER_ID = 'gloom' as const

export async function preloadGloomGlb(): Promise<boolean> {
  return preloadRosterGlbBoot(FIGHTER_ID)
}

export function createGloomGlbMesh(): PlaceholderFighterMesh {
  const templateScene: Object3D | null = getRosterGlbTemplate(FIGHTER_ID)
  if (!templateScene) {
    console.warn('[Gloom] createGloomGlbMesh: no template, procedural fallback')
    return createGloomCatMesh()
  }
  return createRiggedGlbFighterMesh({
    fighterId: FIGHTER_ID,
    holderName: 'GloomGlbVisual',
    templateScene,
    mergedAnimations: getRosterGlbClipArray(FIGHTER_ID),
    combatBodyProxyName: 'GloomCombatBodyProxy',
    useIdleAlternation: false,
    stagedGlbLoading: true,
  })
}
