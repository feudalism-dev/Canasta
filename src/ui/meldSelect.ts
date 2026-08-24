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
  const lastRank = naturalRank(lastCards)
  if (isWild(card) || lastRank === null || lastRank === card.rank) {
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
  let next = groups.map((g) => [...g])
  for (const id of ids) {
    if (next.some((g) => g.includes(id))) continue
    const card = byId.get(id)
    if (card) next = addCardToGroups(next, card, byId, config)
  }
  return next
}
