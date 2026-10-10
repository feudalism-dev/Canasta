import { makeCard, type Card, type Rank, type Suit, SUITS } from '../cards'
import { mulberry32 } from '../rng'

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** Standard 52-card deck for Hearts / Spades / Oh Hell. */
export function buildTrickDeck(): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(makeCard(0, suit, rank, 0))
    }
  }
  return cards
}

const EUCHRE_RANKS: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A']

/** 24-card Euchre deck (9–A). */
export function buildEuchreDeck(): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of EUCHRE_RANKS) {
      cards.push(makeCard(0, suit, rank, 0))
    }
  }
  return cards
}

export function shuffleSeeded(items: Card[], seed: number): Card[] {
  const rng = mulberry32(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

/** Ace high … 2 low. */
export function trickRankValue(rank: Rank): number {
  if (rank === 'A') return 14
  if (rank === 'K') return 13
  if (rank === 'Q') return 12
  if (rank === 'J') return 11
  if (rank === '10') return 10
  if (rank === 'JOKER') return 0
  const n = Number(rank)
  return Number.isFinite(n) ? n : 0
}

export function sortTrickHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3, J: 4 }
  return [...cards].sort((a, b) => {
    const s = suitOrder[a.suit] - suitOrder[b.suit]
    if (s !== 0) return s
    return trickRankValue(b.rank) - trickRankValue(a.rank)
  })
}

export function isHeart(card: Card): boolean {
  return card.suit === 'H'
}

export function isQueenOfSpades(card: Card): boolean {
  return card.suit === 'S' && card.rank === 'Q'
}

export function cardPenalty(card: Card): number {
  if (isQueenOfSpades(card)) return 13
  if (isHeart(card)) return 1
  return 0
}
