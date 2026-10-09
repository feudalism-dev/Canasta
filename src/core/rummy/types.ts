import type { Card, Suit } from '../cards'

/** Rummy-family variants. */
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
  /** Melds this player has laid this round (standard mid-hand; gin only after knock). */
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
  /** Ace deadwood (standard/gin: 1). */
  aceDeadwood: number
  playTo: number | null
  /** Gin: max deadwood to knock (classic 10). */
  knockMax?: number
  /** Gin: bonus for going gin (0 deadwood). */
  ginBonus?: number
  /** Gin: bonus when undercutting the knocker. */
  undercutBonus?: number
  /** true = lowest score wins (standard); false = highest wins (gin). */
  scoreAscending: boolean
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
  /** Short summary of the last hand result (knock / gin / draw). */
  lastHandNote: string | null
}

export type RummyMove =
  | { t: 'drawStock' }
  | { t: 'takeDiscard' }
  | { t: 'meld'; cardIds: string[] }
  | { t: 'layoff'; meldOwnerSeat: number; meldId: string; cardIds: string[] }
  | { t: 'discard'; cardId: string }
  /** Gin: discard this card and knock with remaining hand. */
  | { t: 'knock'; cardId: string }

export type SuitOrder = Record<Suit, number>
