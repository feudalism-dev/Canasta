import type { Card, Suit } from '../cards'

/** Rummy-family variants. */
export type RummyVariant = 'standard' | 'gin' | 'oklahoma' | 'rummy500' | 'kalooki'

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
  /** Melds this player has laid this round (standard / 500 / kalooki; gin-style only after knock). */
  melds: RummyMeld[]
  /**
   * Rummy 500: cards laid off onto others' melds still score for you
   * (they also sit on the target meld for play).
   */
  scoredLayoffs: Card[]
  score: number
}

export type RummyConfig = {
  variant: RummyVariant
  playerCount: number
  handSize: number
  deckCount: number
  /** Include jokers as wilds. */
  jokers: boolean
  /** Face cards count as this many deadwood / meld points. */
  faceDeadwood: number
  /** Ace points (red ace in Kalooki; general ace otherwise). */
  aceDeadwood: number
  /** Kalooki: black ace penalty. */
  blackAceDeadwood?: number
  playTo: number | null
  /** Fixed number of hands (Kalooki open = 9). */
  handsPerMatch?: number | null
  /** Gin-style: max deadwood to knock. */
  knockMax?: number
  ginBonus?: number
  undercutBonus?: number
  /** Oklahoma Gin. */
  oklahoma?: boolean
  /** Rummy 500: take from anywhere in the discard fan. */
  deepDiscard?: boolean
  /** Rummy 500: score melds laid minus hand. */
  meldScoring?: boolean
  /** Kalooki: jokers legal in melds. */
  allowJokersInMelds?: boolean
  /** true = lowest score wins; false = highest wins. */
  scoreAscending: boolean
}

/** Per-player score change from the hand that just ended. */
export type RummyHandScoreLine = {
  playerId: string
  name: string
  /** Points added this hand (0 if none; may be negative in Rummy 500). */
  delta: number
  /** Match total after this hand. */
  total: number
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
  lastHandNote: string | null
  lastHandScores: RummyHandScoreLine[] | null
  /** Oklahoma: multiplier for this hand (2 if upcard was a spade). */
  scoreMultThisHand: number
  /**
   * Rummy 500: after a deep discard take, this card must be melded or laid off
   * before the turn can end.
   */
  mustUseCardId: string | null
}

export type RummyMove =
  | { t: 'drawStock' }
  | { t: 'takeDiscard' }
  /** Rummy 500: take discard[fromIndex] and every card above it. */
  | { t: 'takeDiscardDeep'; fromIndex: number }
  | { t: 'meld'; cardIds: string[] }
  | { t: 'layoff'; meldOwnerSeat: number; meldId: string; cardIds: string[] }
  | { t: 'discard'; cardId: string }
  /** Gin / Oklahoma: discard this card and knock with remaining hand. */
  | { t: 'knock'; cardId: string }

export type SuitOrder = Record<Suit, number>
