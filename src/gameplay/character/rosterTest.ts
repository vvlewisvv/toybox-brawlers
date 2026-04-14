import type { CharacterDefinition } from './types'
import { CHARACTER_BIBI } from './bibi'
import { CHARACTER_BRAMBLE } from './bramble'
import { CHARACTER_CHOMP } from './chomp'
import { CHARACTER_EMBERCLAW } from './emberclaw'
import { CHARACTER_GLOOM } from './gloom'
import { CHARACTER_PLACEHOLDER_DEFAULT } from './characterPresets'

/** One roster slot (vs bot + character select UI). */
export type RosterTestEntry = {
  id: string
  label: string
  definition: CharacterDefinition
  /** One-line hook on the character select card. */
  tagline: string
  /** Playstyle label (archetype). */
  role: string
  /**
   * Optional card art served from `public/` (Vite root), e.g. `/characters/emberclaw-portrait.png`.
   * Used as the fighter-select portrait; design targets may also live under `docs/reference/`.
   */
  selectPortraitUrl?: string
}

/** PROJECT_RULES five roster slots. */
export const ROSTER_TEST_ENTRIES: readonly RosterTestEntry[] = [
  {
    id: 'bibi',
    label: 'Bibi',
    definition: CHARACTER_BIBI,
    tagline: 'Tiny terror, endless pressure',
    role: 'All-rounder',
    selectPortraitUrl: '/characters/bibi-portrait.png',
  },
  {
    id: 'bramble',
    label: 'Bramble',
    definition: CHARACTER_BRAMBLE,
    tagline: 'Big swings, long reach',
    role: 'Bruiser',
    selectPortraitUrl: '/characters/bramble-portrait.png',
  },
  {
    id: 'chomp',
    label: 'Chomp',
    definition: CHARACTER_CHOMP,
    tagline: 'In your face — don’t blink',
    role: 'Grappler',
    selectPortraitUrl: '/characters/chomp-portrait.png',
  },
  {
    id: 'emberclaw',
    label: 'Emberclaw',
    definition: CHARACTER_EMBERCLAW,
    tagline: 'Burn bright, hit harder',
    role: 'Specialist',
    selectPortraitUrl: '/characters/emberclaw-portrait.png',
  },
  {
    id: 'gloom',
    label: 'Gloom',
    definition: CHARACTER_GLOOM,
    tagline: 'Low, fast, always smirking',
    role: 'Trickster',
    selectPortraitUrl: '/characters/gloom-portrait.png',
  },
] as const

export const DEFAULT_ROSTER_TEST_P1_ID = 'emberclaw'
export const DEFAULT_ROSTER_TEST_P2_ID = 'chomp'

export function getRosterTestDefinition(id: string): CharacterDefinition {
  const entry = ROSTER_TEST_ENTRIES.find((e) => e.id === id)
  return entry?.definition ?? CHARACTER_PLACEHOLDER_DEFAULT
}

/** Character select cards (accent from `definition.visuals.identity`). */
export type CharacterSelectPresenter = {
  id: string
  label: string
  tagline: string
  role: string
  accentHex: string
  portraitSrc?: string
}

function accentToHex(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`
}

export function rosterEntriesToSelectPresenters(): CharacterSelectPresenter[] {
  return ROSTER_TEST_ENTRIES.map((e) => ({
    id: e.id,
    label: e.label,
    tagline: e.tagline,
    role: e.role,
    accentHex: accentToHex(e.definition.visuals?.identity?.accentColor ?? 0xc4a574),
    portraitSrc: e.selectPortraitUrl,
  }))
}
