/** Ichi (shedding) family — Uno-style. */

export type IchiVariant = 'classic'

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
}

export type IchiPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: IchiCard[]
  score: number
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
  /** +1 clockwise, -1 counter-clockwise. */
  direction: 1 | -1
  stock: IchiCard[]
  discard: IchiCard[]
  /** Active color (after wilds / top card). */
  currentColor: IchiColor
  /** Player who must name a color (wild / wdf). */
  colorPicker: number | null
  /** Pending WDF challenge window: index of player who may challenge. */
  challengeTarget: number | null
  /** Who played the WDF under challenge. */
  wdfPlayer: number | null
  /** Color in force before the WDF (for legality check). */
  colorBeforeWdf: IchiColor | null
  /** Who must still call Ichi (played to 1 without calling). */
  ichiPending: number | null
  /** Players who have called Ichi this hand while at 1 card. */
  ichiCalled: boolean[]
  /** Whether the pending WDF was legal when played. */
  wdfLegal: boolean | null
  /** After drawing a playable card, must play it or pass. */
  drawnPlayableId: string | null
  winnerId: string | null
  log: string[]
  lastHandNote: string | null
  lastHandScores: IchiHandScoreLine[] | null
  lastMessage: string | null
}

export type IchiMove =
  | { t: 'play'; cardId: string }
  | { t: 'draw' }
  | { t: 'pass' }
  | { t: 'chooseColor'; color: IchiColor }
  | { t: 'callIchi' }
  | { t: 'challenge' }
  | { t: 'acceptWdf' }
