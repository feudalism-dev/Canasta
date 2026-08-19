import { pickAiMove, type AiDifficulty } from './heuristic'
import { forcePass, getLegalMoves, tryApply } from '../core/rules'
import type { MatchState } from '../core/types'

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

export function stepComputer(state: MatchState, difficulty: AiDifficulty): boolean {
  const who = nextComputerIndex(state)
  if (who == null) return false
  if (state.phase === 'awaitingGoOutConsent') {
    const move =
      pickAiMove(state, who, difficulty) ??
      getLegalMoves(state, who).find((m) => m.kind === 'consentGoOut') ??
      null
    if (!move) return false
    return tryApply(state, move, who).ok
  }
  const move =
    pickAiMove(state, who, difficulty) ??
    getLegalMoves(state, who).find((m) => m.kind === 'discard') ??
    null
  if (move) {
    const res = tryApply(state, move, who)
    if (res.ok) return true
  }
  const discard = getLegalMoves(state, who).find((m) => m.kind === 'discard')
  if (discard) {
    tryApply(state, discard, who)
    return true
  }
  forcePass(state)
  return true
}

const THINK_MS = 380

export async function pumpComputers(
  state: MatchState,
  difficulty: AiDifficulty,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: () => void
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
    if (!stepComputer(state, difficulty)) break
    opts.onStep()
  }
  opts.onThinking(false)
}
