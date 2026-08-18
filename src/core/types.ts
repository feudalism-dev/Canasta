import type { Card, MeldRank } from './cards'

export type Variant = 'canasta' | 'handAndFoot'

export type HouseRules = {
  goingOutClean: number
  goingOutDirty: number
  wildBooksAllowed: boolean
  partnerConsent: boolean
}

export const DEFAULT_HOUSE: HouseRules = {
  goingOutClean: 1,
  goingOutDirty: 1,
  wildBooksAllowed: true,
  partnerConsent: true,
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
  house: HouseRules
}

export type Meld = {
  rank: MeldRank
  cards: Card[]
  closed: boolean
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
  | { kind: 'meld'; cardIds: string[] }
  | { kind: 'addToMeld'; meldIndex: number; cardIds: string[] }
  | { kind: 'discard'; cardId: string }
  | { kind: 'consentGoOut'; accept: boolean }
  | { kind: 'continue' }

export type ApplyResult = { ok: true } | { ok: false; error: string }
