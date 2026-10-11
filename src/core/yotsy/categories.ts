import type { YotsyCategory } from './types'

export const UPPER_CATEGORIES: YotsyCategory[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
]

export const LOWER_CATEGORIES: YotsyCategory[] = [
  'threeKind',
  'fourKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
]

export const ALL_CATEGORIES: YotsyCategory[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]

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
