/** Row! Sham! Bo! — directional RPS parlor family. */

export type RowShamBoVariant = 'classic' | 'triples' | 'elements'

export type RowShamBoKind =
  | 'rock'
  | 'paper'
  | 'scissors'
  | 'dynamite'
  | 'water'
  | 'earth'
  | 'fire'

export type RowShamBoDirection = 'cw' | 'ccw'

export type RowShamBoPhase =
  | 'chooseDir'
  | 'draw'
  | 'pass'
  | 'play'
  | 'reveal'
  | 'resolve'
  | 'handEnd'
  | 'gameEnd'
  | 'matchEnd'

export type RowShamBoCard = {
  id: string
  kind: RowShamBoKind
}

export type RowShamBoPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: RowShamBoCard[]
  /** Card chosen to pass this hand (pending exchange). */
  passCardId: string | null
  /** Card played face-down this hand. */
  playCardId: string | null
  /** Points scored this game (one full deck play-through). */
  gameScore: number
  /** Cumulative match points across games. */
  matchScore: number
}

export type RowShamBoConfig = {
  variant: RowShamBoVariant
  playerCount: number
  /** Match ends when a player reaches this (100–500). */
  playTo: number
}

/** One step of the resolution chain (for battle UI). */
export type RowShamBoResolveStep = {
  contested: number[]
  next: number
  outcome: 'tie' | 'contestedWin' | 'nextWin'
  deltas: { seat: number; delta: number }[]
  note: string
}

export type RowShamBoHandScoreLine = {
  playerId: string
  name: string
  delta: number
  gameTotal: number
  matchTotal: number
}

export type RowShamBoState = {
  config: RowShamBoConfig
  players: RowShamBoPlayer[]
  phase: RowShamBoPhase
  /** Seat index of the button / lead for this hand. */
  button: number
  direction: RowShamBoDirection | null
  stock: RowShamBoCard[]
  discard: RowShamBoCard[]
  /** Face-down plays locked for this hand (player index → card). */
  tablePlays: (RowShamBoCard | null)[]
  /** Which table plays are face-up (flipped only when their duel runs). */
  revealed: boolean[]
  handNumber: number
  gameNumber: number
  /** Deadline (ms epoch) for current human pass/play action; null if N/A. */
  actionDeadline: number | null
  resolveSteps: RowShamBoResolveStep[]
  /** Index into resolveSteps while animating; -1 when idle. */
  resolveStepIndex: number
  lastHandScores: RowShamBoHandScoreLine[] | null
  winnerId: string | null
  /** Match tied (multiple at playTo with same score). */
  matchTied: boolean
  log: string[]
  lastMessage: string | null
}

export type RowShamBoMove =
  | { t: 'ackDir' }
  | { t: 'pass'; cardId: string }
  | { t: 'play'; cardId: string }
  | { t: 'ackReveal' }
  | { t: 'ackResolve' }
  | { t: 'ackHandEnd' }
  | { t: 'ackGameEnd' }
  | { t: 'timeout' }
