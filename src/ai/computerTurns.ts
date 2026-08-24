import { pickAiMove, type AiDifficulty } from './heuristic'
import { forcePass, getLegalMoves, tryApply } from '../core/rules'
import { cloneState } from '../core/state'
import type { GameMove, MatchState } from '../core/types'

export function nextComputerIndex(state: MatchState): number | null {
  if (state.phase === 'matchEnd' || state.phase === 'roundEnd') return null
  if (state.phase === 'awaitingGoOutConsent' && state.pendingGoOut) {
    const pending = state.pendingGoOut.playerIndex
    const partner = state.players.findIndex((p, i) => p.team === state.players[pending]!.team && i !== pending)
    if (partner >= 0 && !state.players[partner]!.isHuman) return partner
    return null
  }
  const cur = state.players[state.currentPlayer]
  if (cur && !cur.isHuman) return state.currentPlayer
  return null
}

/** Apply one computer move; returns the move when something was applied. */
export function stepComputer(
  state: MatchState,
  difficulty: AiDifficulty,
): { move: GameMove; playerIndex: number; prev: MatchState } | null {
  const who = nextComputerIndex(state)
  if (who == null) return null
  const prev = cloneState(state)
  if (state.phase === 'awaitingGoOutConsent') {
    const move =
      pickAiMove(state, who, difficulty) ??
      getLegalMoves(state, who).find((m) => m.kind === 'consentGoOut') ??
      null
    if (!move) return null
    if (!tryApply(state, move, who).ok) return null
    return { move, playerIndex: who, prev }
  }
  const move =
    pickAiMove(state, who, difficulty) ??
    getLegalMoves(state, who).find((m) => m.kind === 'discard') ??
    null
  if (move) {
    const res = tryApply(state, move, who)
    if (res.ok) return { move, playerIndex: who, prev }
  }
  const discard = getLegalMoves(state, who).find((m) => m.kind === 'discard')
  if (discard) {
    tryApply(state, discard, who)
    return { move: discard, playerIndex: who, prev }
  }
  forcePass(state)
  return { move: { kind: 'pass' }, playerIndex: who, prev }
}

const THINK_MS = 380

export async function pumpComputers(
  state: MatchState,
  difficulty: AiDifficulty,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (info: { move: GameMove; playerIndex: number; prev: MatchState }) => void
  },
): Promise<void> {
  let lastWho = -1
  let guard = 0
  while (!opts.isCancelled() && guard++ < 80) {
    const who = nextComputerIndex(state)
    if (who == null) {
      opts.onThinking(false)
      return
    }
    if (who !== lastWho) {
      opts.onThinking(true)
      await new Promise<void>((r) => setTimeout(r, THINK_MS))
      lastWho = who
    }
    if (opts.isCancelled()) return
    const stepped = stepComputer(state, difficulty)
    if (!stepped) break
    opts.onStep(stepped)
  }
  opts.onThinking(false)
}
