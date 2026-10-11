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

export function lowerCategories(variant: YotsyVariant): YotsyCategory[] {
  return variant === 'kismet' ? KISMET_LOWER : CLASSIC_LOWER
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

export function categoryLabel(c: YotsyCategory): string {
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
  return variant === 'kismet' ? 'kismet' : 'yahtzee'
}
