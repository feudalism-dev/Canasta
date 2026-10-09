import type { RummyConfig, RummyVariant } from './types'

export function rummyConfig(variant: RummyVariant, playerCount: number): RummyConfig {
  if (variant === 'gin') {
    return {
      variant,
      playerCount: 2,
      handSize: 10,
      deckCount: 1,
      jokers: false,
      faceDeadwood: 10,
      aceDeadwood: 1,
      playTo: 100,
      knockMax: 10,
      ginBonus: 25,
      undercutBonus: 25,
      scoreAscending: false,
    }
  }
  const n = Math.max(2, Math.min(4, playerCount))
  return {
    variant: 'standard',
    playerCount: n,
    handSize: 7,
    deckCount: n >= 4 ? 2 : 1,
    jokers: false,
    faceDeadwood: 10,
    aceDeadwood: 1,
    playTo: 100,
    scoreAscending: true,
  }
}

export function rummyVariantOptions(): { value: RummyVariant; label: string; ready: boolean }[] {
  return [
    { value: 'standard', label: 'Standard Rummy — to 100 (lowest wins)', ready: true },
    { value: 'gin', label: 'Gin Rummy — 2 players, to 100 (highest wins)', ready: true },
  ]
}

/** Gin is always 2 seats; standard allows 2–4. */
export function clampRummyPlayerCount(variant: RummyVariant, playerCount: number): number {
  if (variant === 'gin') return 2
  return Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
}
