/** Yotsy — dice parlor family (Yahtzee-style). */

export type YotsyVariant = 'classic' | 'dismet'

export type YotsyPhase = 'play' | 'matchEnd'

/** Classic scorecard categories (13 boxes). */
export type YotsyCategory =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'threeKind'
  | 'fourKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yahtzee'
  | 'chance'

export type YotsyDie = {
  id: string
  /** Face 1–6 after a roll. */
  value: number
  held: boolean
}

export type YotsyScorecard = Partial<Record<YotsyCategory, number>>

export type YotsyPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  card: YotsyScorecard
  /** Extra Yahtzee bonuses (+100 each) after the Yahtzee box is 50. */
  yahtzeeBonuses: number
  /** Turns completed (max 13). */
  turnsDone: number
}

export type YotsyConfig = {
  variant: YotsyVariant
  playerCount: number
  playTo: number | null
}

export type YotsyState = {
  config: YotsyConfig
  players: YotsyPlayer[]
  phase: YotsyPhase
  current: number
  round: number
  dice: YotsyDie[]
  /** Rolls remaining this turn (3 at start; decrement after each roll). */
  rollsLeft: number
  /** True after at least one roll this turn. */
  hasRolled: boolean
  winnerId: string | null
  log: string[]
  lastMessage: string | null
  /** Brief note after scoring a box. */
  lastScoreNote: string | null
}

export type YotsyMove =
  | { t: 'toggleHold'; dieId: string }
  | { t: 'roll' }
  | { t: 'score'; category: YotsyCategory }
