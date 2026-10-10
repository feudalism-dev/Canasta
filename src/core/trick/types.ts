import type { Card, Suit } from '../cards'

/** Trick-taking family variants. */
export type TrickVariant = 'hearts' | 'rooster' | 'spades' | 'euchre' | 'ohhell'

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
  /** Points / tricks taken this hand (variant-specific). */
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
  /** Highest score wins (default true for most); Hearts uses lowest. */
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
  /** Hearts broken / Spades broken (trump lead unlocked). */
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

  // --- Shared auction / trump fields ---
  /** Dealer engine index (rotates each hand). */
  dealer: number
  /** Rooster/Euchre: current high bid amount. */
  bidAmount: number
  /** Rooster/Euchre: high bidder / maker index. */
  bidderIndex: number | null
  /** Rooster/Euchre: who has passed this auction. */
  bidPassed: boolean[]
  /** Rooster nest / Euchre kitty / Oh Hell leftover. */
  nest: Card[]
  /** Named trump (Spades fixed ♠; Rooster/Euchre/Oh Hell set). */
  trump: Suit | null
  /** Team points taken this hand [0+2, 1+3] where used. */
  teamTaken: [number, number]
  /** Per-player bid this hand (Spades / Oh Hell); null = not yet. */
  playerBids: (number | null)[]
  /** Spades sandbags accumulated [team0, team1]. */
  bags: [number, number]
  /** Cards dealt per player this hand (Oh Hell varies; Euchre 5). */
  handSize: number
  /** Euchre: maker going alone. */
  alone: boolean
  /** Euchre bid round (1 = order-up suit, 2 = name other). */
  euchreRound: number
}

export type TrickMove =
  | { t: 'pass'; cardIds: string[] }
  | { t: 'play'; cardId: string }
  | { t: 'bid'; amount: number }
  | { t: 'passBid' }
  | { t: 'nestDiscard'; cardIds: string[] }
  | { t: 'nameTrump'; suit: Suit }
