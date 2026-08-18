import { isWild, type Card } from '../core/cards'

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

export function addCardToGroups(groups: string[][], card: Card, byId: Map<string, Card>): string[][] {
  const next = groups.map((g) => [...g])
  const found = next.findIndex((g) => g.includes(card.id))
  if (found >= 0) {
    next[found] = next[found]!.filter((id) => id !== card.id)
    return next.filter((g) => g.length > 0)
  }
  if (next.length === 0) return [[card.id]]
  const last = next[next.length - 1]!
  const lastRank = naturalRank(cardsOf(last, byId))
  if (isWild(card) || lastRank === null || lastRank === card.rank) {
    last.push(card.id)
    return next
  }
  return [...next, [card.id]]
}

export function addRankToGroups(groups: string[][], ids: string[], byId: Map<string, Card>): string[][] {
  const allOn = ids.length > 0 && ids.every((id) => groups.some((g) => g.includes(id)))
  if (allOn) {
    const drop = new Set(ids)
    return groups.map((g) => g.filter((id) => !drop.has(id))).filter((g) => g.length > 0)
  }
  let next = groups.map((g) => [...g])
  for (const id of ids) {
    if (next.some((g) => g.includes(id))) continue
    const card = byId.get(id)
    if (card) next = addCardToGroups(next, card, byId)
  }
  return next
}
