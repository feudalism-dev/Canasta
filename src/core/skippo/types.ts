/** Skippo — sequencing parlor family (Skip-Bo style). */

export type SkippoVariant = 'classic'

export type SkippoRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type SkippoPhase = 'play' | 'roundEnd' | 'matchEnd'

export type SkippoCard = {
  id: string
  /** null = wild Skippo card */
  rank: SkippoRank | null
}

export type SkippoBuilder = {
  cards: SkippoCard[]
  /** Next rank required (1–12). Empty pile wants 1. */
  next: number
}

export type SkippoPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: SkippoCard[]
  /** Face-down stock; last card is the face-up top. */
  stock: SkippoCard[]
  /** Four personal discard piles (tops playable). */
  discards: [SkippoCard[], SkippoCard[], SkippoCard[], SkippoCard[]]
  score: number
}

export type SkippoConfig = {
  variant: SkippoVariant
  playerCount: number
  playTo: number | null
  stockSize: number
}

export type SkippoHandScoreLine = {
  playerId: string
  name: string
  delta: number
  total: number
}

export type SkippoState = {
  config: SkippoConfig
  players: SkippoPlayer[]
  phase: SkippoPhase
  current: number
  round: number
  /** Shared draw pile. */
  draw: SkippoCard[]
  /** Completed builder cards awaiting reshuffle. */
  recycle: SkippoCard[]
  builders: [SkippoBuilder, SkippoBuilder, SkippoBuilder, SkippoBuilder]
  /** True after hand refill this turn; false until discard ends turn. */
  filled: boolean
  winnerId: string | null
  log: string[]
  lastHandNote: string | null
  lastHandScores: SkippoHandScoreLine[] | null
  lastMessage: string | null
}

export type SkippoSource = 'hand' | 'stock' | 'discard'

export type SkippoMove =
  | { t: 'play'; source: SkippoSource; builder: 0 | 1 | 2 | 3; cardId?: string; discardIndex?: 0 | 1 | 2 | 3 }
  | { t: 'discard'; cardId: string; discardIndex: 0 | 1 | 2 | 3 }
