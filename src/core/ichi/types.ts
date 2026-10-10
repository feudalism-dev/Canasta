/** Ichi (shedding) family — color-card parlor games. */

export type IchiVariant = 'classic' | 'eights' | 'dos' | 'switch' | 'palace' | 'flip'

export type IchiColor = 'R' | 'Y' | 'G' | 'B'

export type IchiKind =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wdf'
  | 'flip'

/** Dark-side kinds for Flip (subset). */
export type IchiDarkKind = IchiKind

export type IchiPhase =
  | 'play'
  | 'colorPick'
  | 'challenge'
  | 'roundEnd'
  | 'matchEnd'

export type IchiCard = {
  id: string
  color: IchiColor | null
  kind: IchiKind
  /** Flip: face when the table is on the dark side. */
  darkColor?: IchiColor | null
  darkKind?: IchiKind
}

export type IchiPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: IchiCard[]
  score: number
  /** Palace: 3 face-down. */
  palaceDown?: IchiCard[]
  /** Palace: 3 face-up. */
  palaceUp?: IchiCard[]
  /** Palace hands won (match scoring). */
  handsWon?: number
}

export type IchiConfig = {
  variant: IchiVariant
  playerCount: number
  playTo: number | null
}

export type IchiHandScoreLine = {
  playerId: string
  name: string
  delta: number
  total: number
}

export type IchiState = {
  config: IchiConfig
  players: IchiPlayer[]
  phase: IchiPhase
  current: number
  round: number
  direction: 1 | -1
  stock: IchiCard[]
  discard: IchiCard[]
  /** DOS: second discard pile. */
  discardB: IchiCard[]
  currentColor: IchiColor
  /** DOS: color of pile B. */
  currentColorB: IchiColor
  colorPicker: number | null
  challengeTarget: number | null
  wdfPlayer: number | null
  colorBeforeWdf: IchiColor | null
  ichiPending: number | null
  ichiCalled: boolean[]
  wdfLegal: boolean | null
  drawnPlayableId: string | null
  /** Switch: stacked draw debt for the next player. */
  pendingDraw: number
  /** Which DOS pile colorPick applies to (0 / 1). */
  colorPickPile: 0 | 1 | null
  /** Flip: light or dark table side. */
  flipSide: 'light' | 'dark'
  winnerId: string | null
  log: string[]
  lastHandNote: string | null
  lastHandScores: IchiHandScoreLine[] | null
  lastMessage: string | null
}

export type IchiMove =
  | { t: 'play'; cardId: string; pile?: 0 | 1 }
  | { t: 'playTwo'; cardIds: [string, string]; pile?: 0 | 1 }
  | { t: 'draw' }
  | { t: 'pass' }
  | { t: 'chooseColor'; color: IchiColor }
  | { t: 'callIchi' }
  | { t: 'challenge' }
  | { t: 'acceptWdf' }
  | { t: 'takePile' }
