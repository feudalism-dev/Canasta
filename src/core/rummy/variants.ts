import type { RummyConfig, RummyVariant } from './types'

export function rummyConfig(variant: RummyVariant, playerCount: number): RummyConfig {
  const n = Math.max(2, Math.min(4, playerCount))
  if (variant === 'gin') {
    return {
      variant,
      playerCount: Math.min(2, n),
      handSize: 10,
      deckCount: 1,
      jokers: false,
      faceDeadwood: 10,
      aceDeadwood: 1,
      playTo: 100,
    }
  }
  return {
    variant: 'standard',
    playerCount: n,
    handSize: 7,
    deckCount: n >= 4 ? 2 : 1,
    jokers: false,
    faceDeadwood: 10,
    aceDeadwood: 1,
    playTo: 100,
  }
}

export function rummyVariantOptions(): { value: RummyVariant; label: string; ready: boolean }[] {
  return [
    { value: 'standard', label: 'Standard Rummy — to 100', ready: true },
    { value: 'gin', label: 'Gin Rummy (soon)', ready: false },
  ]
}
