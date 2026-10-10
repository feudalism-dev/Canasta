import type { Card, Suit } from '../cards'

/** Trick-taking family variants. */
export type TrickVariant = 'hearts' | 'rooster' | 'spades' | 'euchre'

export type TrickPhase =
  | 'pass'
  | 'bid'
  | 'nest'
  | 'trump'
  | 'play'
  | 'roundEnd'
  | 'matchEnd'

export type PassDirection = 'left' | 'right' | 'across' | 'hold'

export type TrickPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: Card[]
  /** Points taken this hand (Hearts penalties / Rooster counters). */
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
  /** Highest score wins (Rooster); Hearts uses lowest. */
  scoreAscending?: boolean
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
  /** Engine index whose turn it is. */
  current: number
  round: number
  passDirection: PassDirection
  /** Hearts: seats that have submitted a pass this round. */
  passed: boolean[]
  /** Hearts: pending pass selections by engine index. */
  passQueue: (Card[] | null)[]
  heartsBroken: boolean
  /** Cards in the current trick, in play order. */
  trick: PlayedCard[]
  /** Engine index that led the current trick. */
  trickLeader: number
  /** Completed tricks this hand. */
  tricksTaken: number[]
  winnerId: string | null
  log: string[]
  lastHandNote: string | null
  lastHandScores: TrickHandScoreLine[] | null
  /** Short note after a trick is won (cleared when the next card is led). */
  lastTrickNote: string | null

  // --- Rooster (partnership) ---
  /** Dealer engine index (rotates each hand). */
  dealer: number
  /** Current high bid (0 = none yet). */
  bidAmount: number
  /** High bidder engine index, or null until set. */
  bidderIndex: number | null
  /** Who has passed this auction (cannot re-enter). */
  bidPassed: boolean[]
  /** Face-down nest (5), or buried nest after discard. */
  nest: Card[]
  /** Named trump color (null until named). Bird is always top trump. */
  trump: Suit | null
  /** Team counters this hand [seats 0+2, seats 1+3] before contract resolve. */
  teamTaken: [number, number]
}

export type TrickMove =
  | { t: 'pass'; cardIds: string[] }
  | { t: 'play'; cardId: string }
  | { t: 'bid'; amount: number }
  | { t: 'passBid' }
  | { t: 'nestDiscard'; cardIds: string[] }
  | { t: 'nameTrump'; suit: Suit }
