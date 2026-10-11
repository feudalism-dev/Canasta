/** Yotsy — dice parlor family (Yahtzee-style + Kismet). */

export type YotsyVariant = 'classic' | 'kismet'

export type YotsyPhase = 'play' | 'matchEnd'

/** Die pip color (Kismet): 1/6 black, 2/5 red, 3/4 green. */
export type YotsyDieColor = 'black' | 'red' | 'green'

/** Classic + Kismet scorecard categories. */
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
  /** Kismet-only */
  | 'twoPairColor'
  | 'straight'
  | 'flush'
  | 'fullHouseColor'
  | 'yarborough'
  | 'kismet'

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
  /** Extra Yotsy/Kismet bonuses after the five-of-a-kind box is filled. */
  yahtzeeBonuses: number
  /** Turns completed (max = boxes for variant). */
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
