import type { Card, Rank } from '../cards'
import { rankRunValueHighAce, rankRunValueLow, sameSuit } from './deck'
import type { RummyConfig } from './types'

function naturals(cards: Card[]): Card[] {
  return cards.filter((c) => c.rank !== 'JOKER')
}

function jokerCount(cards: Card[]): number {
  return cards.filter((c) => c.rank === 'JOKER').length
}

function allSameRankNatural(cards: Card[]): Rank | null {
  const nat = naturals(cards)
  if (nat.length === 0) return null
  const r = nat[0]!.rank
  if (nat.some((c) => c.rank !== r)) return null
  return r
}

/** Set: 3–4 of a rank. With jokers: need ≥2 naturals of that rank. */
export function isSet(cards: Card[], allowJokers = false): boolean {
  if (cards.length < 3 || cards.length > 4) return false
  if (!allowJokers || jokerCount(cards) === 0) {
    const r = cards[0]!.rank
    if (r === 'JOKER') return false
    return cards.every((c) => c.rank === r)
  }
  const rank = allSameRankNatural(cards)
  if (rank == null) return false
  if (naturals(cards).length < 2) return false
  return true
}

function isConsecutive(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! !== sorted[i - 1]! + 1) return false
  }
  return true
}

/** Can jokers fill gaps so naturals form a consecutive same-suit run of `cards.length`? */
function isRunWithJokers(cards: Card[]): boolean {
  const nat = naturals(cards)
  const jokers = jokerCount(cards)
  if (nat.length + jokers < 3) return false
  if (nat.length === 0) return false
  const suit = sameSuit(nat)
  if (suit == null) return false

  const tryValues = (vals: number[]): boolean => {
    if (new Set(vals).size !== vals.length) return false
    const sorted = [...vals].sort((a, b) => a - b)
    const span = sorted[sorted.length - 1]! - sorted[0]! + 1
    const gaps = span - sorted.length
    if (gaps > jokers) return false
    // Remaining jokers extend ends — always OK if total length matches
    return sorted.length + jokers === cards.length && gaps <= jokers
  }

  const low = nat.map((c) => rankRunValueLow(c.rank))
  if (tryValues(low)) return true
  if (nat.some((c) => c.rank === 'A')) {
    const high = nat.map((c) => rankRunValueHighAce(c.rank))
    if (tryValues(high)) return true
  }
  return false
}

/** Run: 3+ same suit, consecutive. Ace high or low, not wrapping. */
export function isRun(cards: Card[], allowJokers = false): boolean {
  if (cards.length < 3) return false
  if (allowJokers && jokerCount(cards) > 0) return isRunWithJokers(cards)
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

export function classifyMeld(cards: Card[], config?: RummyConfig): 'set' | 'run' | null {
  const j = Boolean(config?.allowJokersInMelds)
  if (isSet(cards, j)) return 'set'
  if (isRun(cards, j)) return 'run'
  return null
}

export function canLayOff(
  meldCards: Card[],
  kind: 'set' | 'run',
  add: Card[],
  config?: RummyConfig,
): string | null {
  if (add.length === 0) return 'No cards to add'
  if (meldCards.length < 3) return 'Not a complete meld'
  const next = [...meldCards, ...add]
  const j = Boolean(config?.allowJokersInMelds)
  if (kind === 'set') {
    if (next.length > 4) return 'Sets may have at most 4 cards'
    if (!isSet(next, j)) return 'Layoff must match the set rank'
    return null
  }
  if (!isRun(next, j)) return 'Layoff must extend the run'
  return null
}

/** Melds that accept these hand cards as a layoff (any player's table melds). */
export function layoffTargets(
  players: { seat: number; name: string; melds: { id: string; kind: 'set' | 'run'; cards: Card[] }[] }[],
  add: Card[],
  config?: RummyConfig,
): { seat: number; meldId: string; ownerName: string; kind: 'set' | 'run' }[] {
  if (add.length === 0) return []
  const out: { seat: number; meldId: string; ownerName: string; kind: 'set' | 'run' }[] = []
  for (const pl of players) {
    for (const m of pl.melds) {
      if (canLayOff(m.cards, m.kind, add, config) == null) {
        out.push({ seat: pl.seat, meldId: m.id, ownerName: pl.name, kind: m.kind })
      }
    }
  }
  return out
}
