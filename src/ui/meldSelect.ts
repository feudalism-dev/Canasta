import { isWild, type Card } from '../core/cards'
import { isSequenceNatural, naturalSequenceValue, sortSequenceCards } from '../core/sequences'
import type { VariantConfig } from '../core/types'

function cardsOf(ids: string[], byId: Map<string, Card>): Card[] {
  return ids.map((id) => byId.get(id)).filter((c): c is Card => Boolean(c))
}

function naturalRank(cards: Card[]): string | null {
  const naturals = cards.filter((c) => !isWild(c))
  if (!naturals.length) return null
  const rank = naturals[0]!.rank
  if (naturals.some((c) => c.rank !== rank)) return 'MIXED'
  return rank
}

function isConsecutiveSequence(cards: Card[]): boolean {
  if (cards.length < 2) return true
  const sorted = sortSequenceCards(cards)
  for (let i = 1; i < sorted.length; i++) {
    const prev = naturalSequenceValue(sorted[i - 1]!.rank)
    const curr = naturalSequenceValue(sorted[i]!.rank)
    if (prev === null || curr === null || curr !== prev + 1) return false
  }
  return true
}

function sameSuit(cards: Card[]): boolean {
  if (!cards.length) return true
  const suit = cards[0]!.suit
  return cards.every((c) => c.suit === suit)
}

/** Whether card extends or starts a same-suit consecutive run with existing cards. */
function fitsSequenceGroup(existing: Card[], card: Card): boolean {
  if (!isSequenceNatural(card)) return false
  if (!existing.length) return true
  const naturals = existing.filter((c) => isSequenceNatural(c))
  if (!naturals.length) return true
  if (!sameSuit(naturals) || naturals[0]!.suit !== card.suit) return false
  return isConsecutiveSequence([...naturals, card])
}

function groupIsAllWild(ids: string[], byId: Map<string, Card>): boolean {
  const cards = cardsOf(ids, byId)
  return cards.length > 0 && cards.every((c) => isWild(c))
}

/** Pair of naturals that still needs a wild to become a legal meld. */
function needsWildToComplete(ids: string[], byId: Map<string, Card>): boolean {
  const cards = cardsOf(ids, byId)
  if (cards.length !== 2) return false
  if (cards.some((c) => isWild(c))) return false
  const rank = naturalRank(cards)
  return Boolean(rank && rank !== 'MIXED')
}

export function addCardToGroups(
  groups: string[][],
  card: Card,
  byId: Map<string, Card>,
  config?: VariantConfig,
): string[][] {
  const next = groups.map((g) => [...g])
  const found = next.findIndex((g) => g.includes(card.id))
  if (found >= 0) {
    next[found] = next[found]!.filter((id) => id !== card.id)
    return next.filter((g) => g.length > 0)
  }
  if (next.length === 0) return [[card.id]]
  const last = next[next.length - 1]!
  const lastCards = cardsOf(last, byId)
  if (config?.sequencesEnabled && fitsSequenceGroup(lastCards, card)) {
    last.push(card.id)
    return next
  }
  if (isWild(card)) {
    // Prefer an existing all-wild staging group (wild book), not gluing onto naturals.
    const wildIdx = next.findIndex((g) => groupIsAllWild(g, byId))
    if (wildIdx >= 0) {
      next[wildIdx]!.push(card.id)
      return next
    }
    if (needsWildToComplete(last, byId)) {
      last.push(card.id)
      return next
    }
    // Complete natural/dirty set already staged — start a separate wild book.
    if (lastCards.some((c) => !isWild(c)) && lastCards.length >= 3) {
      return [...next, [card.id]]
    }
    last.push(card.id)
    return next
  }
  const lastRank = naturalRank(lastCards)
  if (lastRank === null || lastRank === card.rank) {
    last.push(card.id)
    return next
  }
  return [...next, [card.id]]
}

export function addRankToGroups(
  groups: string[][],
  ids: string[],
  byId: Map<string, Card>,
  config?: VariantConfig,
): string[][] {
  const allOn = ids.length > 0 && ids.every((id) => groups.some((g) => g.includes(id)))
  if (allOn) {
    const drop = new Set(ids)
    return groups.map((g) => g.filter((id) => !drop.has(id))).filter((g) => g.length > 0)
  }
  const cards = ids.map((id) => byId.get(id)).filter((c): c is Card => Boolean(c))
  // Tapping Deuces / Wild ★ should stage a wild book, not dump every wild onto the last natural set.
  if (cards.length > 0 && cards.every((c) => isWild(c))) {
    let next = groups.map((g) => [...g])
    const remaining = [...ids]
    if (next.length > 0 && needsWildToComplete(next[next.length - 1]!, byId) && remaining.length > 0) {
      const last = next[next.length - 1]!
      last.push(remaining.shift()!)
    }
    if (!remaining.length) return next
    const wildIdx = next.findIndex((g) => groupIsAllWild(g, byId))
    if (wildIdx >= 0) {
      next[wildIdx] = [...next[wildIdx]!, ...remaining]
      return next
    }
    return [...next, remaining]
  }
  let next = groups.map((g) => [...g])
  for (const id of ids) {
    if (next.some((g) => g.includes(id))) continue
    const card = byId.get(id)
    if (card) next = addCardToGroups(next, card, byId, config)
  }
  return next
}
