import type { Card, Suit } from '../cards'

/** Rummy-family variants (Gin is phase 2). */
export type RummyVariant = 'standard' | 'gin'

export type RummyPhase = 'draw' | 'meld' | 'discard' | 'roundEnd' | 'matchEnd'

export type RummyMeld = {
  id: string
  /** 'set' = same rank; 'run' = same suit consecutive. */
  kind: 'set' | 'run'
  cards: Card[]
}

export type RummyPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: Card[]
  /** Melds this player (or team) has laid this round. */
  melds: RummyMeld[]
  score: number
}

export type RummyConfig = {
  variant: RummyVariant
  playerCount: number
  handSize: number
  deckCount: number
  /** Include jokers as wilds (standard v1: false). */
  jokers: boolean
  /** Face cards count as this many deadwood points. */
  faceDeadwood: number
  /** Ace deadwood (standard: 1). */
  aceDeadwood: number
  playTo: number | null
}

export type RummyState = {
  config: RummyConfig
  players: RummyPlayer[]
  stock: Card[]
  discard: Card[]
  phase: RummyPhase
  current: number
  round: number
  /** True after the current player has drawn this turn. */
  drew: boolean
  winnerId: string | null
  log: string[]
}

export type RummyMove =
  | { t: 'drawStock' }
  | { t: 'takeDiscard' }
  | { t: 'meld'; cardIds: string[] }
  | { t: 'layoff'; meldOwnerSeat: number; meldId: string; cardIds: string[] }
  | { t: 'discard'; cardId: string }

export type SuitOrder = Record<Suit, number>
