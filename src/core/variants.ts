import type { HouseRules, Variant, VariantConfig } from './types'
import { houseForVariant, isHandAndFoot, isSambaFamily } from './houseRules'
import type { Variant } from './types'

export { DEFAULT_HOUSE } from './houseRules'

/** Samba and Bolivia appear in game selectors as beta variants. */
export const SHOW_SAMBA_VARIANTS = true

export const BETA_VARIANT_NOTICE =
  'Beta variant — rules and scoring may change. Please report bugs you find while testing.'

export type VariantOption = {
  value: Variant
  label: string
  beta: boolean
}

/** Options for setup / lobby dropdowns (stable games first, then beta). */
export function variantOptions(): VariantOption[] {
  const opts: VariantOption[] = [
    { value: 'canasta', label: 'Classic Canasta — to 5,000', beta: false },
    { value: 'handAndFoot', label: 'Pagat Hand & Foot — 4 rounds', beta: false },
    { value: 'handAndFootHouse', label: 'House Rules Hand & Foot — 4 rounds', beta: false },
  ]
  if (SHOW_SAMBA_VARIANTS) {
    opts.push({ value: 'samba', label: 'Samba (Beta) — to 10,000', beta: true })
    opts.push({ value: 'bolivia', label: 'Bolivia (Beta) — to 15,000', beta: true })
  }
  return opts
}

const CLASSIC_SEQUENCE_FLAGS = {
  sequencesEnabled: false,
  allowMultipleGroupsSameRank: false,
  sequencesCloseAtSeven: false,
  goingOutRule: 'canasta' as const,
  redThreeMode: 'classic' as const,
  blockTakePileOnWildTop: false,
}

const HF_SEQUENCE_FLAGS = {
  sequencesEnabled: false,
  allowMultipleGroupsSameRank: false,
  sequencesCloseAtSeven: false,
  goingOutRule: 'handAndFoot' as const,
  redThreeMode: 'handAndFoot' as const,
  blockTakePileOnWildTop: false,
}

export function variantConfig(
  variant: Variant,
  playerCount: number,
  house?: Partial<HouseRules> | null,
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
      house: houseForVariant('canasta'),
      ...CLASSIC_SEQUENCE_FLAGS,
    }
  }
  if (variant === 'samba' || variant === 'bolivia') {
    const houseRules = houseForVariant(variant)
    return {
      variant,
      deckCount: 3,
      handSize: 15,
      footSize: 0,
      stockDraw: 2,
      playTo: variant === 'samba' ? 10000 : 15000,
      rounds: null,
      canastaSize: 7,
      canastaMayExceed: true,
      maxWildsPerMeld: variant === 'samba' ? 2 : 7,
      minNaturalsToStart: 2,
      minNaturalsForDirtyBook: 4,
      freezeOnWildDiscard: false,
      takePileNeedsTwoNaturalsAlways: true,
      redThreeReplacement: false,
      booksCloseAtSeven: false,
      requireDiscardToGoOut: true,
      goingOutNeedsCanasta: false,
      concealedBonus: false,
      sequencesEnabled: true,
      allowMultipleGroupsSameRank: true,
      sequencesCloseAtSeven: true,
      goingOutRule: variant,
      redThreeMode: 'samba',
      blockTakePileOnWildTop: variant === 'bolivia',
      house: houseRules,
    }
  }
  const houseRules = houseForVariant(variant, house)
  return {
    variant,
    deckCount: n === 2 ? 3 : 5,
    handSize: 13,
    footSize: 13,
    stockDraw: 2,
    playTo: null,
    rounds: 4,
    canastaSize: 7,
    canastaMayExceed: houseRules.addToClosedBooks,
    maxWildsPerMeld: 7,
    minNaturalsToStart: 2,
    minNaturalsForDirtyBook: 4,
    freezeOnWildDiscard: true,
    takePileNeedsTwoNaturalsAlways: houseRules.requireNaturalPairToTakePile,
    redThreeReplacement: houseRules.replaceRedThreesFromHand,
    booksCloseAtSeven: true,
    requireDiscardToGoOut: houseRules.requireDiscardToGoOut,
    goingOutNeedsCanasta: false,
    concealedBonus: false,
    house: houseRules,
    ...HF_SEQUENCE_FLAGS,
  }
}

export function initialMeldMinimum(config: VariantConfig, teamScore: number, round: number): number {
  if (isHandAndFoot(config.variant)) {
    const table = [50, 90, 120, 150]
    const idx = Math.min(Math.max(round - 1, 0), 3)
    return table[idx] ?? 50
  }
  if (isSambaFamily(config.variant)) {
    if (teamScore < 0) return 15
    if (teamScore < 1500) return 50
    if (teamScore < 3000) return 90
    if (teamScore < 7000) return 120
    return 150
  }
  if (teamScore < 0) return 15
  if (teamScore < 1500) return 50
  if (teamScore < 3000) return 90
  return 120
}

export function teamOfSeat(seat: number): 0 | 1 {
  return (seat % 2 === 0 ? 0 : 1) as 0 | 1
}
