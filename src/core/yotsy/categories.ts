import type { YotsyCategory, YotsyVariant } from './types'

export const UPPER_CATEGORIES: YotsyCategory[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
]

export const CLASSIC_LOWER: YotsyCategory[] = [
  'threeKind',
  'fourKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
]

export const KISMET_LOWER: YotsyCategory[] = [
  'twoPairColor',
  'threeKind',
  'straight',
  'flush',
  'fullHouse',
  'fullHouseColor',
  'fourKind',
  'yarborough',
  'kismet',
]

/** Yacht (1938): 12 boxes — no 3oak, no upper bonus. */
export const YACHT_LOWER: YotsyCategory[] = [
  'fullHouse',
  'fourKind',
  'smallStraight',
  'largeStraight',
  'chance',
  'yahtzee',
]

/** Generala: escalera, full, póker, generala, doble. */
export const GENERALA_LOWER: YotsyCategory[] = [
  'straight',
  'fullHouse',
  'fourKind',
  'generala',
  'doubleGenerala',
]

export function lowerCategories(variant: YotsyVariant): YotsyCategory[] {
  if (variant === 'kismet') return KISMET_LOWER
  if (variant === 'yacht') return YACHT_LOWER
  if (variant === 'generala') return GENERALA_LOWER
  return CLASSIC_LOWER
}

export function allCategories(variant: YotsyVariant): YotsyCategory[] {
  return [...UPPER_CATEGORIES, ...lowerCategories(variant)]
}

/** @deprecated use allCategories(variant) */
export const ALL_CATEGORIES: YotsyCategory[] = [...UPPER_CATEGORIES, ...CLASSIC_LOWER]

/** @deprecated use lowerCategories('classic') */
export const LOWER_CATEGORIES = CLASSIC_LOWER

export function turnsNeeded(variant: YotsyVariant): number {
  return allCategories(variant).length
}

export function categoryLabel(c: YotsyCategory, variant: YotsyVariant = 'classic'): string {
  if (variant === 'yacht') {
    if (c === 'smallStraight') return 'Little Straight'
    if (c === 'largeStraight') return 'Big Straight'
    if (c === 'chance') return 'Choice'
    if (c === 'yahtzee') return 'YACHT'
  }
  if (variant === 'generala') {
    if (c === 'straight') return 'Escalera'
    if (c === 'fullHouse') return 'Full'
    if (c === 'fourKind') return 'Póker'
    if (c === 'generala') return 'GENERALA'
    if (c === 'doubleGenerala') return 'Doble Generala'
  }
  switch (c) {
    case 'ones':
      return 'Aces'
    case 'twos':
      return 'Twos'
    case 'threes':
      return 'Threes'
    case 'fours':
      return 'Fours'
    case 'fives':
      return 'Fives'
    case 'sixes':
      return 'Sixes'
    case 'threeKind':
      return '3 of a Kind'
    case 'fourKind':
      return '4 of a Kind'
    case 'fullHouse':
      return 'Full House'
    case 'smallStraight':
      return 'Sm. Straight'
    case 'largeStraight':
      return 'Lg. Straight'
    case 'yahtzee':
      return 'YOTSY'
    case 'chance':
      return 'Chance'
    case 'twoPairColor':
      return '2 Pair Same Color'
    case 'straight':
      return 'Straight'
    case 'flush':
      return 'Flush'
    case 'fullHouseColor':
      return 'FH Same Color'
    case 'yarborough':
      return 'Yarborough'
    case 'kismet':
      return 'KISMET'
    case 'generala':
      return 'GENERALA'
    case 'doubleGenerala':
      return 'Doble Generala'
  }
}

export function upperFace(c: YotsyCategory): number | null {
  if (c === 'ones') return 1
  if (c === 'twos') return 2
  if (c === 'threes') return 3
  if (c === 'fours') return 4
  if (c === 'fives') return 5
  if (c === 'sixes') return 6
  return null
}

export function isUpper(c: YotsyCategory): boolean {
  return UPPER_CATEGORIES.includes(c)
}

/** Five-of-a-kind box for the variant. */
export function fiveKindCategory(variant: YotsyVariant): YotsyCategory {
  if (variant === 'kismet') return 'kismet'
  if (variant === 'generala') return 'generala'
  return 'yahtzee'
}

/** Classic / Kismet track upper-section bonuses; Yacht / Generala do not. */
export function hasUpperBonus(variant: YotsyVariant): boolean {
  return variant === 'classic' || variant === 'kismet'
}

/** Classic / Kismet award extra chips for later five-of-a-kinds. */
export function hasFiveKindBonus(variant: YotsyVariant): boolean {
  return variant === 'classic' || variant === 'kismet'
}
