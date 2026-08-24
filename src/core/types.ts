import type { Card, MeldRank, Suit } from './cards'

export type Variant = 'canasta' | 'handAndFoot' | 'handAndFootHouse' | 'samba' | 'bolivia'

export type MeldKind = 'group' | 'sequence'

export type GoingOutRule = 'canasta' | 'handAndFoot' | 'samba' | 'bolivia'

export type RedThreeMode = 'classic' | 'handAndFoot' | 'samba'

export type HouseRules = {
  goingOutClean: number
  goingOutDirty: number
  wildBooksAllowed: boolean
  partnerConsent: boolean
  /** Hand and Foot: keep adding matching cards after a book hits seven. */
  addToClosedBooks: boolean
  /** Hand and Foot: must discard the last card to go out. */
  requireDiscardToGoOut: boolean
  /** Hand and Foot: pile pickup always needs two naturals of the top rank. */
  requireNaturalPairToTakePile: boolean
  /** Auto-lay red 3s from Hand on deal / stock draw / pile bury. */
  autoplayRedThreesOnDraw: boolean
  /** Auto-lay red 3s when the Foot is picked up. */
  autoplayRedThreesOnFootOpen: boolean
  /** Draw replacements when red 3s are laid from Hand (deal/draw/pile). */
  replaceRedThreesFromHand: boolean
  /** Draw replacements when red 3s are laid on Foot open. */
  replaceRedThreesOnFootOpen: boolean
  /** Discarding a red 3 onto the pile freezes it. */
  redThreeDiscardFreezes: boolean
  /** Laid red 3s score positive points. */
  redThreeScoreEnabled: boolean
  redThreeScorePoints: number
  /** Red 3s still in Hand at round end cost points. */
  redThreeHandEndPenalty: boolean
  redThreeHandEndPenaltyPoints: number
  /** Red 3s still in an unopened Foot at round end cost points. */
  redThreeSealedFootPenalty: boolean
  redThreeSealedFootPenaltyPoints: number
  /** Points charged for each black 3 left in Hand or Foot. */
  blackThreeEndPenaltyPoints: number
  /** When true, take only the top 7 discard cards; otherwise the whole pile. */
  takeDiscardTopSeven: boolean
}

export type VariantConfig = {
  variant: Variant
  deckCount: number
  handSize: number
  footSize: number
  stockDraw: number
  playTo: number | null
  rounds: number | null
  canastaSize: number
  canastaMayExceed: boolean
  maxWildsPerMeld: number
  minNaturalsToStart: number
  minNaturalsForDirtyBook: number
  freezeOnWildDiscard: boolean
  takePileNeedsTwoNaturalsAlways: boolean
  redThreeReplacement: boolean
  booksCloseAtSeven: boolean
  requireDiscardToGoOut: boolean
  goingOutNeedsCanasta: boolean
  concealedBonus: boolean
  /** Samba/Bolivia: allow sequence melds (runs in suit). */
  sequencesEnabled: boolean
  /** Samba/Bolivia: more than one open group of the same rank. */
  allowMultipleGroupsSameRank: boolean
  /** Samba/Bolivia: sequences close at seven (sambas). Groups may still exceed seven when allowed. */
  sequencesCloseAtSeven: boolean
  goingOutRule: GoingOutRule
  redThreeMode: RedThreeMode
  /** Bolivia: cannot take discard pile when top card is wild. */
  blockTakePileOnWildTop: boolean
  house: HouseRules
}

export type Meld = {
  rank: MeldRank
  cards: Card[]
  closed: boolean
  /** Omit or 'group' for Classic Canasta and Hand & Foot. */
  kind?: MeldKind
  /** Same-suit sequences only (Samba/Bolivia). */
  suit?: Suit
}

export type PlayerState = {
  displayName: string
  isHuman: boolean
  team: 0 | 1
  seat: number
  hand: Card[]
  foot: Card[]
  footPickedUp: boolean
  meldedThisHand: boolean
  concealedEligible: boolean
}

export type TeamState = {
  melds: Meld[]
  redThrees: Card[]
  score: number
  hasInitialMeld: boolean
}

export type Phase = 'awaitingDraw' | 'awaitingPlay' | 'awaitingGoOutConsent' | 'roundEnd' | 'matchEnd'

export type PendingGoOut = {
  playerIndex: number
  discardId: string | null
}

export type MatchState = {
  config: VariantConfig
  phase: Phase
  players: PlayerState[]
  teams: [TeamState, TeamState]
  stock: Card[]
  discard: Card[]
  discardFrozen: boolean
  currentPlayer: number
  dealer: number
  round: number
  lastMessage: string
  winnerTeam: number
  pendingGoOut: PendingGoOut | null
  seed: number
  turnNumber: number
  wentOutPlayer: number
}

export type GameMove =
  | { kind: 'drawStock' }
  | { kind: 'takePile'; cardIds: string[] }
  | { kind: 'meld'; cardIds: string[]; groups?: string[][] }
  | { kind: 'addToMeld'; meldIndex: number; cardIds: string[] }
  | { kind: 'discard'; cardId: string }
  | { kind: 'consentGoOut'; accept: boolean }
  | { kind: 'goOut' }
  | { kind: 'continue' }

export type ApplyResult = { ok: true } | { ok: false; error: string }
