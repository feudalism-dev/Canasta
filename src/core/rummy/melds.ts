import type { Card, Rank } from '../cards'
import { rankRunValueHighAce, rankRunValueLow, sameSuit } from './deck'

function allSameRank(cards: Card[]): Rank | null {
  if (cards.length < 3) return null
  const r = cards[0]!.rank
  if (r === 'JOKER') return null
  if (cards.some((c) => c.rank !== r)) return null
  return r
}

/** Set: 3–4 cards of one rank (no jokers in v1). */
export function isSet(cards: Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false
  return allSameRank(cards) != null
}

function isConsecutive(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! !== sorted[i - 1]! + 1) return false
  }
  return true
}

/** Run: 3+ same suit, consecutive. Ace may be low (A-2-3) or high (Q-K-A), not both (no K-A-2). */
export function isRun(cards: Card[]): boolean {
  if (cards.length < 3) return false
  if (sameSuit(cards) == null) return false
  if (cards.some((c) => c.rank === 'JOKER')) return false
  const low = cards.map((c) => rankRunValueLow(c.rank))
  if (new Set(low).size !== cards.length) return false
  if (isConsecutive(low)) return true
  const hasAce = cards.some((c) => c.rank === 'A')
  if (!hasAce) return false
  const high = cards.map((c) => rankRunValueHighAce(c.rank))
  if (new Set(high).size !== cards.length) return false
  return isConsecutive(high)
}

export function classifyMeld(cards: Card[]): 'set' | 'run' | null {
  if (isSet(cards)) return 'set'
  if (isRun(cards)) return 'run'
  return null
}

export function canLayOff(meldCards: Card[], kind: 'set' | 'run', add: Card[]): string | null {
  if (add.length === 0) return 'No cards to add'
  if (meldCards.length < 3) return 'Not a complete meld'
  const next = [...meldCards, ...add]
  if (kind === 'set') {
    if (next.length > 4) return 'Sets may have at most 4 cards'
    const rank = meldCards[0]!.rank
    if (rank === 'JOKER' || add.some((c) => c.rank !== rank)) {
      return 'Layoff must match the set rank'
    }
    return null
  }
  if (!isRun(next)) return 'Layoff must extend the run'
  return null
}

/** Melds that accept these hand cards as a layoff (any player's table melds). */
export function layoffTargets(
  players: { seat: number; name: string; melds: { id: string; kind: 'set' | 'run'; cards: Card[] }[] }[],
  add: Card[],
): { seat: number; meldId: string; ownerName: string; kind: 'set' | 'run' }[] {
  if (add.length === 0) return []
  const out: { seat: number; meldId: string; ownerName: string; kind: 'set' | 'run' }[] = []
  for (const pl of players) {
    for (const m of pl.melds) {
      if (canLayOff(m.cards, m.kind, add) == null) {
        out.push({ seat: pl.seat, meldId: m.id, ownerName: pl.name, kind: m.kind })
      }
    }
  }
  return out
}
