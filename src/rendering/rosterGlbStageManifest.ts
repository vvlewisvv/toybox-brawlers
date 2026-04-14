/**
 * Single manifest for roster GLB URLs and how they map to the 3-stage asset pipeline.
 * Stage 1: character rig + idle preview · Stage 2: locomotion + combat clips · Stage 3: KO + win.
 */
export const ROSTER_GLB_FIGHTER_IDS = [
  'bibi',
  'bramble',
  'chomp',
  'emberclaw',
  'gloom',
] as const

export type RosterGlbFighterId = (typeof ROSTER_GLB_FIGHTER_IDS)[number]

export function isRosterGlbFighterId(id: string): id is RosterGlbFighterId {
  return (ROSTER_GLB_FIGHTER_IDS as readonly string[]).includes(id)
}

export type RosterGlbStageUrls = {
  character: string
  /** Idle (and optional other menu-safe clips) — merged with `mergeTaggedClips` prefixes. */
  bootTagged: readonly { url: string; prefix: string }[]
  combatWalkRun: { walk: string; run: string }
  /** Attacks, block, hurt — not KO / win. */
  combatTagged: readonly { url: string; prefix: string }[]
  roundEndTagged: readonly { url: string; prefix: string }[]
}

export const ROSTER_GLB_STAGE_MANIFEST: Record<RosterGlbFighterId, RosterGlbStageUrls> = {
  bibi: {
    character: '/models/Bibi.glb',
    bootTagged: [{ url: '/models/Bibi-Idle.glb', prefix: 'idle' }],
    combatWalkRun: { walk: '/models/Bibi-Walk.glb', run: '/models/Bibi-Run.glb' },
    combatTagged: [
      { url: '/models/Bibi-AttackLight.glb', prefix: 'jab' },
      { url: '/models/Bibi-AttackMedium.glb', prefix: 'atkmed' },
      { url: '/models/Bibi-AttackHeavy.glb', prefix: 'atkheavy' },
      { url: '/models/Bibi-Block.glb', prefix: 'block' },
      { url: '/models/Bibi-Hit.glb', prefix: 'hurt' },
    ],
    roundEndTagged: [
      { url: '/models/Bibi-KO.glb', prefix: 'ko' },
      { url: '/models/Bibi-Win.glb', prefix: 'win' },
    ],
  },
  bramble: {
    character: '/models/bramble.glb',
    bootTagged: [{ url: '/models/bramble-Idle.glb', prefix: 'idle' }],
    combatWalkRun: { walk: '/models/bramble-Walk.glb', run: '/models/bramble-Run.glb' },
    combatTagged: [
      { url: '/models/bramble-AttackLight.glb', prefix: 'jab' },
      { url: '/models/bramble-AttackMedium.glb', prefix: 'atkmed' },
      { url: '/models/bramble-AttackHeavy.glb', prefix: 'atkheavy' },
      { url: '/models/bramble-Block.glb', prefix: 'block' },
      { url: '/models/bramble-Hit.glb', prefix: 'hurt' },
    ],
    roundEndTagged: [
      { url: '/models/bramble-KO.glb', prefix: 'ko' },
      { url: '/models/bramble-Win.glb', prefix: 'win' },
    ],
  },
  chomp: {
    character: '/models/chomp.glb',
    bootTagged: [{ url: '/models/chomp-Idle.glb', prefix: 'idle' }],
    combatWalkRun: { walk: '/models/chomp-Walk.glb', run: '/models/chomp-Run.glb' },
    combatTagged: [
      { url: '/models/chomp-AttackLight.glb', prefix: 'jab' },
      { url: '/models/chomp-AttackMedium.glb', prefix: 'atkmed' },
      { url: '/models/chomp-AttackHeavy.glb', prefix: 'atkheavy' },
      { url: '/models/chomp-Block.glb', prefix: 'block' },
      { url: '/models/chomp-Hit.glb', prefix: 'hurt' },
    ],
    roundEndTagged: [
      { url: '/models/chomp-KO.glb', prefix: 'ko' },
      { url: '/models/chomp-Win.glb', prefix: 'win' },
    ],
  },
  emberclaw: {
    character: '/models/emberclaw.glb',
    bootTagged: [{ url: '/models/emberclaw-Idle.glb', prefix: 'idle' }],
    combatWalkRun: { walk: '/models/emberclaw-walk.glb', run: '/models/emberclaw-Run.glb' },
    combatTagged: [
      { url: '/models/emberclaw-AttackLight.glb', prefix: 'jab' },
      { url: '/models/emberclaw-AttackMedium.glb', prefix: 'atkmed' },
      { url: '/models/emberclaw-AttackHeavy.glb', prefix: 'atkheavy' },
      { url: '/models/emberclaw-Block.glb', prefix: 'block' },
      { url: '/models/emberclaw-Hit.glb', prefix: 'hurt' },
    ],
    roundEndTagged: [
      { url: '/models/emberclaw-KO.glb', prefix: 'ko' },
      { url: '/models/emberclaw-Win.glb', prefix: 'win' },
    ],
  },
  gloom: {
    character: '/models/gloom.glb',
    bootTagged: [{ url: '/models/gloom-Idle.glb', prefix: 'idle' }],
    combatWalkRun: { walk: '/models/gloom-Walk.glb', run: '/models/gloom-Run.glb' },
    combatTagged: [
      { url: '/models/gloom-AttackLight.glb', prefix: 'jab' },
      { url: '/models/gloom-AttackMedium.glb', prefix: 'atkmed' },
      { url: '/models/gloom-AttackHeavy.glb', prefix: 'atkheavy' },
      { url: '/models/gloom-Block.glb', prefix: 'block' },
      { url: '/models/gloom-Hit.glb', prefix: 'hurt' },
    ],
    roundEndTagged: [
      { url: '/models/gloom-Knock.glb', prefix: 'ko' },
      { url: '/models/gloom-WIN.glb', prefix: 'win' },
    ],
  },
}
