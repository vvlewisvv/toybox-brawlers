import { createPlaceholderFighterMesh } from '../../rendering/placeholderFighterMesh'
import type { CharacterDefinition } from './types'

/** Default tan plush — starter / P1. */
export const CHARACTER_PLACEHOLDER_DEFAULT: CharacterDefinition = {
  id: 'placeholder_default',
  displayName: 'Placeholder',
  visuals: {
    identity: { shortName: 'P1', accentColor: 0xc4a574 },
  },
  createMesh: () => createPlaceholderFighterMesh(),
}

/** Blue plush bot — distinct `visuals.identity` + mesh colors. */
export const CHARACTER_PLACEHOLDER_BOT: CharacterDefinition = {
  id: 'placeholder_bot_blue',
  displayName: 'Bot',
  visuals: {
    identity: { shortName: 'BOT', accentColor: 0x5a8ec9 },
  },
  createMesh: () =>
    createPlaceholderFighterMesh({
      bodyColor: 0x5a8ec9,
      headColor: 0x7ab8e8,
      fighterId: 'placeholder_bot_blue',
    }),
}
