/** Phase It — phase-racing parlor family (Phase 10 style). */

/** classic = 1→10 order · masters = any remaining order · sprint = 1→5 only */
export type PhaseItVariant = 'classic' | 'masters' | 'sprint'

export type PhaseItColor = 'R' | 'Y' | 'G' | 'B'

export type PhaseItKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'wild' | 'skip'

export type PhaseItPhase = 'play' | 'roundEnd' | 'matchEnd'

export type PhaseItCard = {
  id: string
  color: PhaseItColor | null
  kind: PhaseItKind
}

/** One laid group on the table (set, run, or color block). */
export type PhaseItMeld = {
  cards: PhaseItCard[]
  /** 'set' | 'run' | 'color' */
  kind: 'set' | 'run' | 'color'
}

export type PhaseItPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  hand: PhaseItCard[]
  /**
   * Active phase index for this hand (into CLASSIC_PHASES).
   * Masters: -1 until the player chooses; classic/sprint: next remaining.
   */
  phase: number
  /** Phase indexes still needed to win (classic/sprint stay ordered; masters any order). */
  remaining: number[]
  /** Melds laid this hand after completing the current phase requirement. */
  laid: PhaseItMeld[]
  /** True once this hand’s phase was successfully laid. */
  phaseDown: boolean
  score: number
}

export type PhaseItConfig = {
  variant: PhaseItVariant
  playerCount: number
  /** Unused — win is first to clear remaining phases (tie-break: lowest score). */
  playTo: number | null
}

export type PhaseItHandScoreLine = {
  playerId: string
  name: string
  delta: number
  total: number
  phase: number
}

export type PhaseItState = {
  config: PhaseItConfig
  players: PhaseItPlayer[]
  phase: PhaseItPhase
  current: number
  round: number
  stock: PhaseItCard[]
  discard: PhaseItCard[]
  /** Must draw before discard each turn. */
  hasDrawn: boolean
  winnerId: string | null
  log: string[]
  lastHandNote: string | null
  lastHandScores: PhaseItHandScoreLine[] | null
  lastMessage: string | null
}

export type PhaseItMove =
  | { t: 'choosePhase'; phaseIndex: number }
  | { t: 'drawStock' }
  | { t: 'drawDiscard' }
  | { t: 'layPhase'; groups: string[][] }
  | { t: 'hit'; cardId: string; target: number; meldIndex: number }
  | { t: 'discard'; cardId: string }
