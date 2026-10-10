import { makeCard, type Card, type Rank, type Suit, SUITS } from '../cards'
import { shuffleSeeded } from './deck'

/** Partnership Rooster (Hasbro-style): 5–14 in four colors + bird. Map 11–14 → J,Q,K,A. */
const ROOSTER_RANKS: Rank[] = ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** French suit → Rook color label. */
export const ROOSTER_COLOR: Record<Exclude<Suit, 'J'>, string> = {
  C: 'Green',
  H: 'Red',
  D: 'Yellow',
  S: 'Black',
}

export const ROOSTER_COLOR_SHORT: Record<Exclude<Suit, 'J'>, string> = {
  C: 'G',
  H: 'R',
  D: 'Y',
  S: 'K',
}

export function isRoosterBird(card: Card): boolean {
  return card.rank === 'JOKER' || card.suit === 'J'
}

/** Face value 5–14 (bird = 20 for ranking as top trump). */
export function roosterRankValue(card: Card): number {
  if (isRoosterBird(card)) return 20
  if (card.rank === 'A') return 14
  if (card.rank === 'K') return 13
  if (card.rank === 'Q') return 12
  if (card.rank === 'J') return 11
  if (card.rank === '10') return 10
  const n = Number(card.rank)
  return Number.isFinite(n) ? n : 0
}

export function roosterFaceLabel(card: Card): string {
  if (isRoosterBird(card)) return 'Bird'
  return String(roosterRankValue(card))
}

export function roosterColorLabel(card: Card): string {
  if (isRoosterBird(card)) return 'Rooster'
  if (card.suit === 'J') return 'Rooster'
  return ROOSTER_COLOR[card.suit as Exclude<Suit, 'J'>] ?? card.suit
}

/** Counters only: 5→5, 10→10, 14→10, bird→20. Total 120. */
export function roosterCounterPoints(card: Card): number {
  if (isRoosterBird(card)) return 20
  if (card.rank === 'A') return 10 // 14
  if (card.rank === '10') return 10
  if (card.rank === '5') return 5
  return 0
}

export function buildRoosterDeck(): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of ROOSTER_RANKS) {
      cards.push(makeCard(0, suit, rank, 0))
    }
  }
  cards.push(makeCard(0, 'J', 'JOKER', 0))
  return cards
}

export function shuffleRoosterDeck(seed: number): Card[] {
  return shuffleSeeded(buildRoosterDeck(), seed)
}

export function sortRoosterHand(cards: Card[], trump: Suit | null = null): Card[] {
  const suitOrder = (s: Suit): number => {
    if (s === 'J') return -1
    if (trump && s === trump) return 0
    const order: Suit[] = trump
      ? [trump, ...SUITS.filter((x) => x !== trump), 'J']
      : ['C', 'H', 'D', 'S', 'J']
    const i = order.indexOf(s)
    return i >= 0 ? i + 1 : 9
  }
  return [...cards].sort((a, b) => {
    const birdA = isRoosterBird(a) ? 0 : 1
    const birdB = isRoosterBird(b) ? 0 : 1
    if (birdA !== birdB) return birdA - birdB
    if (isRoosterBird(a)) return 0
    const s = suitOrder(a.suit) - suitOrder(b.suit)
    if (s !== 0) return s
    return roosterRankValue(b) - roosterRankValue(a)
  })
}

export const ROOSTER_NEST_SIZE = 5
export const ROOSTER_HAND_SIZE = 9
export const ROOSTER_MIN_BID = 70
export const ROOSTER_MAX_BID = 120
export const ROOSTER_BID_STEP = 5
export const ROOSTER_COUNTER_TOTAL = 120
