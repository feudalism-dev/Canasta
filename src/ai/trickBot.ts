import { cardPenalty, isQueenOfSpades } from '../core/trick/deck'
import { applyTrickMove, legalPlays } from '../core/trick/rules'
import { currentPlayer } from '../core/trick/state'
import type { TrickMove, TrickState } from '../core/trick/types'

/** Dump high penalties when passing; keep low clubs otherwise. */
function passPick(state: TrickState): string[] {
  const me = currentPlayer(state)
  const ranked = [...me.hand].sort((a, b) => {
    const pa = cardPenalty(a) * 10 + (a.suit === 'S' && a.rank === 'A' ? 5 : 0) + (a.suit === 'S' ? 1 : 0)
    const pb = cardPenalty(b) * 10 + (b.suit === 'S' && b.rank === 'A' ? 5 : 0) + (b.suit === 'S' ? 1 : 0)
    return pb - pa
  })
  return ranked.slice(0, 3).map((c) => c.id)
}

/** Prefer low safe cards; avoid taking the Q♠ / hearts when possible. */
function playPick(state: TrickState): string | null {
  const legal = legalPlays(state, state.current)
  if (!legal.length) return null
  const ranked = [...legal].sort((a, b) => {
    const dangerA = cardPenalty(a) * 20 + (isQueenOfSpades(a) ? 50 : 0)
    const dangerB = cardPenalty(b) * 20 + (isQueenOfSpades(b) ? 50 : 0)
    if (dangerA !== dangerB) return dangerA - dangerB
    return a.rank === b.rank ? 0 : a.rank < b.rank ? -1 : 1
  })
  // If following and can duck under trick winner, prefer lowest that still ducks — v1: lowest danger.
  return ranked[0]!.id
}

export function pickTrickBotMove(state: TrickState): TrickMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null
  if (state.phase === 'pass') {
    if (state.passDirection === 'hold') return null
    return { t: 'pass', cardIds: passPick(state) }
  }
  if (state.phase === 'play') {
    const id = playPick(state)
    if (!id) return null
    return { t: 'play', cardId: id }
  }
  return null
}

export function stepTrickBot(state: TrickState): TrickState | null {
  const move = pickTrickBotMove(state)
  if (!move) return null
  const res = applyTrickMove(state, move)
  return res.ok ? res.state : null
}

const THINK_MS = 380

export async function pumpTrickBots(
  state: TrickState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: TrickState) => void
  },
): Promise<TrickState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      const me = currentPlayer(cur)
      if (!me.isComputer) break
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      await new Promise((r) => window.setTimeout(r, THINK_MS))
      if (opts.isCancelled()) break
      const next = stepTrickBot(cur)
      if (!next) break
      cur = next
      opts.onStep(cur)
    }
  } finally {
    opts.onThinking(false)
  }
  return cur
}
