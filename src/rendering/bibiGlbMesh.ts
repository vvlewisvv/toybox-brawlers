import type { Object3D } from 'three'
import { createBibiBearMesh } from './bibiBearMesh'
import { createRiggedGlbFighterMesh } from './glbFighterPipeline'
import type { PlaceholderFighterMesh } from './placeholderFighterMesh'
import { getRosterGlbClipArray, getRosterGlbTemplate, preloadRosterGlbBoot } from './rosterGlbStageCache'

const FIGHTER_ID = 'bibi' as const

export async function preloadBibiGlb(): Promise<boolean> {
  return preloadRosterGlbBoot(FIGHTER_ID)
}

export function createBibiGlbMesh(): PlaceholderFighterMesh {
  const templateScene: Object3D | null = getRosterGlbTemplate(FIGHTER_ID)
  if (!templateScene) {
    console.warn('[Bibi] createBibiGlbMesh: no template, procedural fallback')
    return createBibiBearMesh()
  }
  return createRiggedGlbFighterMesh({
    fighterId: FIGHTER_ID,
    holderName: 'BibiGlbVisual',
    templateScene,
    mergedAnimations: getRosterGlbClipArray(FIGHTER_ID),
    combatBodyProxyName: 'BibiCombatBodyProxy',
    useIdleAlternation: false,
    stagedGlbLoading: true,
    extraAnimOptions: {
      // Bibi balance: medium faster visually, heavy slower visually.
      // (In gameplay mapping, "medium" is `heavy` and "heavy" is `special`.)
      attackPlaybackScaleByKind: {
        heavy: 1.8,
        special: 0.69,
      },
      restartAttackClipOnStartup: true,
      strictAttackClipByKind: true,
      // Prevent idle from ever selecting attack clips after staged clip rescans.
      strictIdleOnly: true,
      clipPatterns: {
        idle: ['idle_', 'idle', 'neutral', 'stand'],
        light: ['jab_', 'jab', 'attacklight', 'atklight'],
        heavy: ['atkmed_', 'atkmed', 'attackmedium'],
        special: ['atkheavy_', 'atkheavy', 'attackheavy'],
      },
    },
  })
}
