import type { Object3D } from 'three'
import { createBrambleBearMesh } from './brambleBearMesh'
import { createRiggedGlbFighterMesh } from './glbFighterPipeline'
import type { PlaceholderFighterMesh } from './placeholderFighterMesh'
import { getRosterGlbClipArray, getRosterGlbTemplate, preloadRosterGlbBoot } from './rosterGlbStageCache'

const FIGHTER_ID = 'bramble' as const

export async function preloadBrambleGlb(): Promise<boolean> {
  return preloadRosterGlbBoot(FIGHTER_ID)
}

export function createBrambleGlbMesh(): PlaceholderFighterMesh {
  const templateScene: Object3D | null = getRosterGlbTemplate(FIGHTER_ID)
  if (!templateScene) {
    console.warn('[Bramble] createBrambleGlbMesh: no template, procedural fallback')
    return createBrambleBearMesh()
  }
  return createRiggedGlbFighterMesh({
    fighterId: FIGHTER_ID,
    holderName: 'BrambleGlbVisual',
    templateScene,
    mergedAnimations: getRosterGlbClipArray(FIGHTER_ID),
    combatBodyProxyName: 'BrambleCombatBodyProxy',
    useIdleAlternation: false,
    stagedGlbLoading: true,
    extraAnimOptions: {
      // Bramble-only: lock idle to neutral idle and pin attack kinds to explicit clips.
      idlePlaybackScale: 0.7,
      strictIdleOnly: true,
      strictAttackClipByKind: true,
      restartAttackClipOnStartup: true,
      clipPatterns: {
        idle: ['idle_', 'idle', 'neutral', 'stand'],
        light: ['jab_', 'jab', 'attacklight', 'atklight'],
        heavy: ['atkmed_', 'atkmed', 'attackmedium'],
        special: ['atkheavy_', 'atkheavy', 'attackheavy'],
      },
    },
  })
}
