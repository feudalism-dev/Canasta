import type { Card } from '../cards'

/** Trick-taking family variants. */
export type TrickVariant = 'hearts' | 'rooster' | 'spades' | 'euchre'

export type TrickPhase = 'pass' | 'play' | 'roundEnd' | 'matchEnd'

export type PassDirection = 'left' | 'right' | 'across' | 'hold'

export type TrickPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: Card[]
  /** Penalty points taken this hand (hearts / Q♠). */
  takenThisHand: number
  score: number
}

export type TrickConfig = {
  variant: TrickVariant
  playerCount: number
  playTo: number | null
  /** Hearts: enable moon shoot. */
  shootTheMoon?: boolean
  /** Partnership (Rooster / Spades / Euchre). */
  partnership?: boolean
}

export type PlayedCard = {
  seat: number
  card: Card
}

export type TrickHandScoreLine = {
  playerId: string
  name: string
  delta: number
  total: number
}

export type TrickState = {
  config: TrickConfig
  players: TrickPlayer[]
  phase: TrickPhase
  /** Engine index whose turn it is (pass select or play). */
  current: number
  round: number
  passDirection: PassDirection
  /** Seats that have submitted a pass this round. */
  passed: boolean[]
  /** Pending pass selections by engine index (3 cards held aside). */
  passQueue: (Card[] | null)[]
  heartsBroken: boolean
  /** Cards in the current trick, in play order. */
  trick: PlayedCard[]
  /** Engine index that led the current trick. */
  trickLeader: number
  /** Completed tricks this hand (for UI / moon check). */
  tricksTaken: number[]
  winnerId: string | null
  log: string[]
  lastHandNote: string | null
  lastHandScores: TrickHandScoreLine[] | null
}

export type TrickMove =
  | { t: 'pass'; cardIds: string[] }
  | { t: 'play'; cardId: string }
