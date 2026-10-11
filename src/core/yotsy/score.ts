import { ALL_CATEGORIES, UPPER_CATEGORIES, isUpper, upperFace } from './categories'
import { counts, hasStraight, isYahtzee, sumValues } from './dice'
import type { YotsyCategory, YotsyPlayer, YotsyScorecard } from './types'

/** Score for placing `values` into `category` (0 allowed — scratch). */
export function scoreCategory(values: number[], category: YotsyCategory): number {
  const c = counts(values)
  const total = sumValues(values)
  const face = upperFace(category)
  if (face != null) {
    return (c[face] ?? 0) * face
  }
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
 * Joker / bonus Yahtzee: when dice are a Yahtzee and the Yahtzee box already has 50,
 * upper of that face scores normally; otherwise lower boxes score their fixed values
 * (full house 25, straights 30/40) even if the dice wouldn't normally qualify.
 */
export function scoreWithJoker(
  values: number[],
  category: YotsyCategory,
  card: YotsyScorecard,
): number {
  const yahtzeeFilled = card.yahtzee === 50
  if (yahtzeeFilled && isYahtzee(values)) {
    const face = values[0]!
    const upperCat = UPPER_CATEGORIES[face - 1]!
    if (category === upperCat) return scoreCategory(values, category)
    if (isUpper(category)) return scoreCategory(values, category)
    // Joker into lower
    if (category === 'fullHouse') return 25
    if (category === 'smallStraight') return 30
    if (category === 'largeStraight') return 40
    if (category === 'threeKind' || category === 'fourKind' || category === 'chance') {
      return sumValues(values)
    }
    if (category === 'yahtzee') return 0 // already filled
  }
  return scoreCategory(values, category)
}

export function upperSubtotal(card: YotsyScorecard): number {
  return UPPER_CATEGORIES.reduce((s, c) => s + (card[c] ?? 0), 0)
}

export function upperBonus(card: YotsyScorecard): number {
  return upperSubtotal(card) >= 63 ? 35 : 0
}

export function lowerSubtotal(card: YotsyScorecard): number {
  return ALL_CATEGORIES.filter((c) => !isUpper(c)).reduce((s, c) => s + (card[c] ?? 0), 0)
}

export function playerTotal(player: YotsyPlayer): number {
  return upperSubtotal(player.card) + upperBonus(player.card) + lowerSubtotal(player.card) + player.yahtzeeBonuses
}

export function openCategories(card: YotsyScorecard): YotsyCategory[] {
  return ALL_CATEGORIES.filter((c) => card[c] == null)
}

export function cardComplete(card: YotsyScorecard): boolean {
  return openCategories(card).length === 0
}
