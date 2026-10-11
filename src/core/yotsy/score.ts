import {
  allCategories,
  fiveKindCategory,
  isUpper,
  lowerCategories,
  UPPER_CATEGORIES,
  upperFace,
} from './categories'
import {
  counts,
  hasFullHouse,
  hasStraight,
  hasTwoPairSameColor,
  isFlush,
  isYahtzee,
  sumValues,
} from './dice'
import type { YotsyCategory, YotsyPlayer, YotsyScorecard, YotsyVariant } from './types'

/** Score for placing `values` into `category` under a variant (0 = scratch). */
export function scoreCategory(
  values: number[],
  category: YotsyCategory,
  variant: YotsyVariant = 'classic',
): number {
  const c = counts(values)
  const total = sumValues(values)
  const face = upperFace(category)
  if (face != null) {
    return (c[face] ?? 0) * face
  }

  if (variant === 'kismet') {
    if (category === 'twoPairColor') return hasTwoPairSameColor(values) ? total : 0
    if (category === 'threeKind') return c.some((n, i) => i > 0 && n >= 3) ? total : 0
    if (category === 'straight') return hasStraight(values, 5) ? 30 : 0
    if (category === 'flush') return isFlush(values) ? 35 : 0
    if (category === 'fullHouse') return hasFullHouse(values) ? total + 15 : 0
    if (category === 'fullHouseColor') {
      return hasFullHouse(values) && isFlush(values) ? total + 20 : 0
    }
    if (category === 'fourKind') return c.some((n, i) => i > 0 && n >= 4) ? total + 25 : 0
    if (category === 'yarborough') return total
    if (category === 'kismet') return isYahtzee(values) ? total + 50 : 0
    return 0
  }

  // Classic Yotsy
  if (category === 'threeKind') {
    return c.some((n, i) => i > 0 && n >= 3) ? total : 0
  }
  if (category === 'fourKind') {
    return c.some((n, i) => i > 0 && n >= 4) ? total : 0
  }
  if (category === 'fullHouse') {
    const has3 = c.some((n, i) => i > 0 && n === 3)
    const has2 = c.some((n, i) => i > 0 && n === 2)
    return has3 && has2 ? 25 : 0
  }
  if (category === 'smallStraight') return hasStraight(values, 4) ? 30 : 0
  if (category === 'largeStraight') return hasStraight(values, 5) ? 40 : 0
  if (category === 'yahtzee') return isYahtzee(values) ? 50 : 0
  if (category === 'chance') return total
  return 0
}

/**
 * Joker / bonus five-of-a-kind after the five-kind box is filled with a real score.
 */
export function scoreWithJoker(
  values: number[],
  category: YotsyCategory,
  card: YotsyScorecard,
  variant: YotsyVariant = 'classic',
): number {
  const five = fiveKindCategory(variant)
  const fiveFilled = (card[five] ?? 0) > 0
  if (fiveFilled && isYahtzee(values)) {
    if (isUpper(category)) return scoreCategory(values, category, variant)
    if (category === five) return 0
    if (variant === 'kismet') {
      // Joker into any open Kismet-section box at that box's "success" score
      if (category === 'twoPairColor' || category === 'threeKind' || category === 'yarborough') {
        return sumValues(values)
      }
      if (category === 'straight') return 30
      if (category === 'flush') return 35
      if (category === 'fullHouse') return sumValues(values) + 15
      if (category === 'fullHouseColor') return sumValues(values) + 20
      if (category === 'fourKind') return sumValues(values) + 25
    } else {
      if (category === 'fullHouse') return 25
      if (category === 'smallStraight') return 30
      if (category === 'largeStraight') return 40
      if (category === 'threeKind' || category === 'fourKind' || category === 'chance') {
        return sumValues(values)
      }
    }
  }
  return scoreCategory(values, category, variant)
}

export function upperSubtotal(card: YotsyScorecard): number {
  return UPPER_CATEGORIES.reduce((s, c) => s + (card[c] ?? 0), 0)
}

/** Classic: 35 at 63+. Kismet: 35 / 55 / 75 at 63 / 71 / 78. */
export function upperBonus(card: YotsyScorecard, variant: YotsyVariant = 'classic'): number {
  const sub = upperSubtotal(card)
  if (variant === 'kismet') {
    if (sub >= 78) return 75
    if (sub >= 71) return 55
    if (sub >= 63) return 35
    return 0
  }
  return sub >= 63 ? 35 : 0
}

export function lowerSubtotal(card: YotsyScorecard, variant: YotsyVariant = 'classic'): number {
  return lowerCategories(variant).reduce((s, c) => s + (card[c] ?? 0), 0)
}

export function playerTotal(player: YotsyPlayer, variant: YotsyVariant = 'classic'): number {
  return (
    upperSubtotal(player.card) +
    upperBonus(player.card, variant) +
    lowerSubtotal(player.card, variant) +
    player.yahtzeeBonuses
  )
}

export function openCategories(card: YotsyScorecard, variant: YotsyVariant = 'classic'): YotsyCategory[] {
  return allCategories(variant).filter((c) => card[c] == null)
}

export function cardComplete(card: YotsyScorecard, variant: YotsyVariant = 'classic'): boolean {
  return openCategories(card, variant).length === 0
}
