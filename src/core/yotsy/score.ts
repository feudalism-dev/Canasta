import {
  allCategories,
  fiveKindCategory,
  hasUpperBonus,
  isUpper,
  lowerCategories,
  UPPER_CATEGORIES,
  upperFace,
} from './categories'
import {
  counts,
  fourKindFaceSum,
  hasExactFullHouse,
  hasFullHouse,
  hasGeneralaStraight,
  hasStraight,
  hasTwoPairSameColor,
  isExactRun,
  isFlush,
  isYahtzee,
  sumValues,
} from './dice'
import type {
  YotsyCategory,
  YotsyPlayer,
  YotsyScorecard,
  YotsyScoreOpts,
  YotsyVariant,
} from './types'

/** Score for placing `values` into `category` under a variant (0 = scratch). */
export function scoreCategory(
  values: number[],
  category: YotsyCategory,
  variant: YotsyVariant = 'classic',
  opts: YotsyScoreOpts = {},
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

  if (variant === 'yacht') {
    if (category === 'fullHouse') return hasExactFullHouse(values) ? total : 0
    if (category === 'fourKind') return fourKindFaceSum(values)
    if (category === 'smallStraight') return isExactRun(values, 1) ? 30 : 0
    if (category === 'largeStraight') return isExactRun(values, 2) ? 30 : 0
    if (category === 'chance') return total
    if (category === 'yahtzee') return isYahtzee(values) ? 50 : 0
    return 0
  }

  if (variant === 'generala') {
    const served = Boolean(opts.served)
    if (category === 'straight') {
      if (!hasGeneralaStraight(values)) return 0
      return served ? 25 : 20
    }
    if (category === 'fullHouse') {
      if (!hasExactFullHouse(values) && !isYahtzee(values)) return 0
      return served ? 35 : 30
    }
    if (category === 'fourKind') {
      if (!c.some((n, i) => i > 0 && n >= 4)) return 0
      return served ? 45 : 40
    }
    if (category === 'generala') return isYahtzee(values) ? 60 : 0
    if (category === 'doubleGenerala') {
      // Scorable only after Generala already holds points
      return isYahtzee(values) ? 100 : 0
    }
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
 * Yacht and Generala have no joker rules.
 */
export function scoreWithJoker(
  values: number[],
  category: YotsyCategory,
  card: YotsyScorecard,
  variant: YotsyVariant = 'classic',
  opts: YotsyScoreOpts = {},
): number {
  if (variant === 'yacht' || variant === 'generala') {
    if (variant === 'generala' && category === 'doubleGenerala') {
      if ((card.generala ?? 0) <= 0) return 0
    }
    return scoreCategory(values, category, variant, opts)
  }

  const five = fiveKindCategory(variant)
  const fiveFilled = (card[five] ?? 0) > 0
  if (fiveFilled && isYahtzee(values)) {
    if (isUpper(category)) return scoreCategory(values, category, variant, opts)
    if (category === five) return 0
    if (variant === 'kismet') {
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
  return scoreCategory(values, category, variant, opts)
}

export function upperSubtotal(card: YotsyScorecard): number {
  return UPPER_CATEGORIES.reduce((s, c) => s + (card[c] ?? 0), 0)
}

/** Classic: 35 at 63+. Kismet: 35 / 55 / 75 at 63 / 71 / 78. Yacht / Generala: none. */
export function upperBonus(card: YotsyScorecard, variant: YotsyVariant = 'classic'): number {
  if (!hasUpperBonus(variant)) return 0
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
