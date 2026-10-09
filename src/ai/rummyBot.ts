import { classifyMeld } from '../core/rummy/melds'
import { applyRummyMove } from '../core/rummy/rules'
import { deadwoodPoints } from '../core/rummy/score'
import { cloneRummy, currentPlayer } from '../core/rummy/state'
import type { RummyMove, RummyState } from '../core/rummy/types'

/** Prefer discarding high deadwood that is not part of an obvious set/run start. */
function discardPick(state: RummyState): string | null {
  const me = currentPlayer(state)
  if (me.hand.length === 0) return null
  let best = me.hand[0]!
  let bestScore = -1
  for (const c of me.hand) {
    const pts = deadwoodPoints(c, state.config)
    if (pts > bestScore) {
      bestScore = pts
      best = c
    }
  }
  return best.id
}

/** Try every 3–4 card combo for a legal meld (small hands — fine for 7–11 cards). */
function findMeldIds(state: RummyState): string[] | null {
  const me = currentPlayer(state)
  const hand = me.hand
  const n = hand.length
  if (n < 3) return null
  for (let len = Math.min(4, n); len >= 3; len--) {
    const idx: number[] = []
    const walk = (start: number, need: number): string[] | null => {
      if (need === 0) {
        const ids = idx.map((i) => hand[i]!.id)
        const cards = idx.map((i) => hand[i]!)
        if (classifyMeld(cards)) return ids
        return null
      }
      for (let i = start; i <= n - need; i++) {
        idx.push(i)
        const hit = walk(i + 1, need - 1)
        if (hit) return hit
        idx.pop()
      }
      return null
    }
    const found = walk(0, len)
    if (found) return found
  }
  return null
}

/** One legal computer action for the current player, or null if not a computer's turn. */
export function pickRummyBotMove(state: RummyState): RummyMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null

  if (!state.drew || state.phase === 'draw') {
    // Prefer discard if it completes a meld in hand (peek); else stock.
    if (state.discard.length > 0) {
      const trial = cloneRummy(state)
      const take = applyRummyMove(trial, { t: 'takeDiscard' })
      if (take.ok && findMeldIds(take.state)) return { t: 'takeDiscard' }
    }
    return { t: 'drawStock' }
  }

  const meldIds = findMeldIds(state)
  if (meldIds) return { t: 'meld', cardIds: meldIds }

  const cardId = discardPick(state)
  if (cardId) return { t: 'discard', cardId }
  return null
}

export function stepRummyBot(state: RummyState): RummyState | null {
  const move = pickRummyBotMove(state)
  if (!move) return null
  const res = applyRummyMove(state, move)
  return res.ok ? res.state : null
}

const THINK_MS = 420

export async function pumpRummyBots(
  state: RummyState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: RummyState) => void
  },
): Promise<RummyState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      const me = currentPlayer(cur)
      if (!me.isComputer) break
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      await new Promise((r) => window.setTimeout(r, THINK_MS))
      if (opts.isCancelled()) break
      const next = stepRummyBot(cur)
      if (!next) break
      cur = next
      opts.onStep(cur)
    }
  } finally {
    opts.onThinking(false)
  }
  return cur
}
