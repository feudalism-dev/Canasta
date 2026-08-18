import type { HouseRules, Variant, VariantConfig } from './types'
import { DEFAULT_HOUSE } from './types'

export { DEFAULT_HOUSE }

export function variantConfig(
  variant: Variant,
  playerCount: number,
  house: HouseRules = DEFAULT_HOUSE,
): VariantConfig {
  const n = playerCount <= 2 ? 2 : 4
  if (variant === 'canasta') {
    return {
      variant,
      deckCount: 2,
      handSize: n === 2 ? 15 : 11,
      footSize: 0,
      stockDraw: 1,
      playTo: 5000,
      rounds: null,
      canastaSize: 7,
      canastaMayExceed: true,
      maxWildsPerMeld: 3,
      minNaturalsToStart: 2,
      minNaturalsForDirtyBook: 4,
      freezeOnWildDiscard: true,
      takePileNeedsTwoNaturalsAlways: false,
      redThreeReplacement: true,
      booksCloseAtSeven: false,
      requireDiscardToGoOut: false,
      goingOutNeedsCanasta: true,
      concealedBonus: true,
      house: { ...DEFAULT_HOUSE, partnerConsent: false, goingOutClean: 0, goingOutDirty: 0, wildBooksAllowed: false },
    }
  }
  return {
    variant,
    deckCount: n === 2 ? 3 : 5,
    handSize: 13,
    footSize: 13,
    stockDraw: 2,
    playTo: null,
    rounds: 4,
    canastaSize: 7,
    canastaMayExceed: house.addToClosedBooks,
    maxWildsPerMeld: 7,
    minNaturalsToStart: 2,
    minNaturalsForDirtyBook: 4,
    freezeOnWildDiscard: true,
    takePileNeedsTwoNaturalsAlways: true,
    redThreeReplacement: false,
    booksCloseAtSeven: true,
    requireDiscardToGoOut: true,
    goingOutNeedsCanasta: false,
    concealedBonus: false,
    house: { ...DEFAULT_HOUSE, ...house },
  }
}

export function initialMeldMinimum(config: VariantConfig, teamScore: number, round: number): number {
  if (config.variant === 'handAndFoot') {
    const table = [50, 90, 120, 150]
    const idx = Math.min(Math.max(round - 1, 0), 3)
    return table[idx] ?? 50
  }
  if (teamScore < 0) return 15
  if (teamScore < 1500) return 50
  if (teamScore < 3000) return 90
  return 120
}

export function teamOfSeat(seat: number): 0 | 1 {
  return (seat % 2 === 0 ? 0 : 1) as 0 | 1
}
