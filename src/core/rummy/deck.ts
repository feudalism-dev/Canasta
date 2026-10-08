import { makeCard, type Card, type Rank, type Suit, SUITS } from '../cards'
import { mulberry32 } from '../rng'

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

/** One or more 52-card decks; optional jokers (not used in standard v1). */
export function buildRummyDeck(deckCount: number, jokers = false): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(makeCard(d, suit, rank, 0))
      }
    }
    if (jokers) {
      cards.push(makeCard(d, 'J', 'JOKER', 0))
      cards.push(makeCard(d, 'J', 'JOKER', 1))
    }
  }
  return cards
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

export function shuffleSeeded(items: Card[], seed: number): Card[] {
  return shuffle(items, mulberry32(seed))
}

/** Run order: Ace low (1) … King (13). Ace-high runs handled separately. */
export function rankRunValueLow(rank: Rank): number {
  if (rank === 'A') return 1
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  if (rank === 'JOKER') return 0
  if (rank === '10') return 10
  const n = Number(rank)
  return Number.isFinite(n) ? n : 0
}

export function rankRunValueHighAce(rank: Rank): number {
  if (rank === 'A') return 14
  return rankRunValueLow(rank)
}

export function sortRummyHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const sa = a.suit.localeCompare(b.suit)
    if (sa !== 0) return sa
    return rankRunValueLow(a.rank) - rankRunValueLow(b.rank) || a.id.localeCompare(b.id)
  })
}

export function sameSuit(cards: Card[]): Suit | null {
  if (cards.length === 0) return null
  const s = cards[0]!.suit
  if (cards.some((c) => c.suit !== s)) return null
  return s
}
