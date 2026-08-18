export type Rank = '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | '3' | 'JOKER'
export type Suit = 'H' | 'D' | 'S' | 'C' | 'J'
export type MeldRank = '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'WILD' | '3'

export type Card = {
  id: string
  rank: Rank
  suit: Suit
}

export const SUITS: Suit[] = ['H', 'D', 'S', 'C']
export const NATURAL_RANKS: MeldRank[] = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const PIPE_RANKS: Rank[] = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3', 'JOKER']

export const MAX_PLAYERS = 4
export const MIN_PLAYERS = 2

export function isRedThree(card: Card): boolean {
  return card.rank === '3' && (card.suit === 'H' || card.suit === 'D')
}

export function isBlackThree(card: Card): boolean {
  return card.rank === '3' && (card.suit === 'S' || card.suit === 'C')
}

export function isWild(card: Card): boolean {
  return card.rank === '2' || card.rank === 'JOKER'
}

export function isNaturalOf(card: Card, rank: MeldRank): boolean {
  if (rank === 'WILD') return false
  if (rank === '3') return isBlackThree(card)
  return card.rank === rank && !isWild(card)
}

export function cardPoints(card: Card): number {
  if (card.rank === 'JOKER') return 50
  if (card.rank === 'A' || card.rank === '2') return 20
  if (card.rank === '3') return isRedThree(card) ? 100 : 5
  if (card.rank === '8' || card.rank === '9' || card.rank === '10' || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
    return 10
  }
  return 5
}

/** Points that count toward an initial meld (red threes never count). */
export function meldCountPoints(card: Card): number {
  if (isRedThree(card)) return 0
  return cardPoints(card)
}

export function rankLabel(rank: Rank | MeldRank): string {
  if (rank === 'JOKER' || rank === 'WILD') return 'Joker'
  if (rank === 'A') return 'Ace'
  if (rank === 'J') return 'Jack'
  if (rank === 'Q') return 'Queen'
  if (rank === 'K') return 'King'
  return String(rank)
}

export function suitGlyph(suit: Suit): string {
  if (suit === 'H') return '♥'
  if (suit === 'D') return '♦'
  if (suit === 'S') return '♠'
  if (suit === 'C') return '♣'
  return '★'
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

export function makeCard(deck: number, suit: Suit, rank: Rank, copy: number): Card {
  return { id: `${deck}-${suit}-${rank}-${copy}`, rank, suit }
}

export function buildDeck(deckCount: number): Card[] {
  const cards: Card[] = []
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of ranks) {
        cards.push(makeCard(d, suit, rank, 0))
      }
    }
    cards.push(makeCard(d, 'J', 'JOKER', 0))
    cards.push(makeCard(d, 'J', 'JOKER', 1))
  }
  return cards
}

export function findCard(cards: Card[], id: string): Card | undefined {
  return cards.find((c) => c.id === id)
}

export function takeCards(from: Card[], ids: string[]): { taken: Card[]; rest: Card[]; missing: string[] } {
  const want = new Set(ids)
  const taken: Card[] = []
  const rest: Card[] = []
  const seen = new Set<string>()
  for (const c of from) {
    if (want.has(c.id) && !seen.has(c.id)) {
      taken.push(c)
      seen.add(c.id)
    } else {
      rest.push(c)
    }
  }
  const missing = ids.filter((id) => !seen.has(id))
  return { taken, rest, missing }
}

export function sortHand(cards: Card[]): Card[] {
  const order: Record<string, number> = {
    '4': 1,
    '5': 2,
    '6': 3,
    '7': 4,
    '8': 5,
    '9': 6,
    '10': 7,
    J: 8,
    Q: 9,
    K: 10,
    A: 11,
    '3': 12,
    '2': 13,
    JOKER: 14,
  }
  return [...cards].sort((a, b) => {
    const ra = order[a.rank] ?? 99
    const rb = order[b.rank] ?? 99
    if (ra !== rb) return ra - rb
    return a.suit.localeCompare(b.suit) || a.id.localeCompare(b.id)
  })
}

export function groupByRank(cards: Card[]): Map<Rank, Card[]> {
  const map = new Map<Rank, Card[]>()
  for (const c of cards) {
    const list = map.get(c.rank) ?? []
    list.push(c)
    map.set(c.rank, list)
  }
  return map
}
