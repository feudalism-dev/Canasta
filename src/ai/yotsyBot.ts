import { UPPER_CATEGORIES } from '../core/yotsy/categories'
import { isYahtzee, valuesOf } from '../core/yotsy/dice'
import { applyYotsyMove } from '../core/yotsy/rules'
import { openCategories, scoreWithJoker } from '../core/yotsy/score'
import { currentPlayer } from '../core/yotsy/state'
import type { YotsyCategory, YotsyMove, YotsyState } from '../core/yotsy/types'

function bestScore(state: YotsyState): { category: YotsyCategory; pts: number } | null {
  const pl = currentPlayer(state)
  const vals = valuesOf(state.dice)
  const open = openCategories(pl.card)
  if (!open.length) return null
  let best: { category: YotsyCategory; pts: number } | null = null
  for (const c of open) {
    const pts = scoreWithJoker(vals, c, pl.card)
    // Prefer real scores; avoid scratching high-value boxes when something scores
    if (!best || pts > best.pts) best = { category: c, pts }
  }
  // If best is 0, scratch chance or lowest upper preference
  if (best && best.pts === 0) {
    if (open.includes('chance')) return { category: 'chance', pts: 0 }
    const upperOpen = UPPER_CATEGORIES.filter((c) => open.includes(c))
    if (upperOpen.length) return { category: upperOpen[upperOpen.length - 1]!, pts: 0 }
  }
  return best
}

function shouldKeepRolling(state: YotsyState): boolean {
  if (state.rollsLeft <= 0) return false
  const vals = valuesOf(state.dice)
  if (isYahtzee(vals)) return false
  const best = bestScore(state)
  // Keep rolling if current best is weak and we have rolls
  if (!best) return false
  if (best.pts >= 25) return false
  if (best.pts >= 15 && state.rollsLeft === 1) return false
  return true
}

function holdForTarget(state: YotsyState): YotsyMove[] {
  const vals = valuesOf(state.dice)
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const v of vals) counts[v]!++
  let target = 1
  let bestN = 0
  for (let f = 1; f <= 6; f++) {
    if ((counts[f] ?? 0) >= bestN) {
      bestN = counts[f]!
      target = f
    }
  }
  const moves: YotsyMove[] = []
  for (const d of state.dice) {
    const wantHeld = d.value === target
    if (d.held !== wantHeld) moves.push({ t: 'toggleHold', dieId: d.id })
  }
  return moves
}

export function pickYotsyBotMove(state: YotsyState): YotsyMove | null {
  if (state.phase !== 'play') return null
  const me = currentPlayer(state)
  if (!me.isComputer) return null

  if (!state.hasRolled) return { t: 'roll' }

  if (shouldKeepRolling(state)) {
    const holds = holdForTarget(state)
    if (holds.length) return holds[0]!
    return { t: 'roll' }
  }

  const best = bestScore(state)
  if (!best) return null
  return { t: 'score', category: best.category }
}

export function stepYotsyBot(state: YotsyState): YotsyState | null {
  const move = pickYotsyBotMove(state)
  if (!move) return null
  const res = applyYotsyMove(state, move)
  return res.ok ? res.state : null
}

const THINK_MS_MIN = 900
const THINK_MS_MAX = 1600

function thinkDelayMs(): number {
  return THINK_MS_MIN + Math.floor(Math.random() * (THINK_MS_MAX - THINK_MS_MIN + 1))
}

export async function pumpYotsyBots(
  state: YotsyState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: YotsyState) => void
    getState?: () => YotsyState
  },
): Promise<YotsyState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'matchEnd') break
      if (!cur.players[cur.current]?.isComputer) break

      await new Promise((r) => window.setTimeout(r, thinkDelayMs()))
      if (opts.isCancelled()) break
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'matchEnd') break
      if (!cur.players[cur.current]?.isComputer) break

      const next = stepYotsyBot(cur)
      if (!next) break
      cur = next
      opts.onStep(cur)
    }
  } finally {
    opts.onThinking(false)
  }
  return cur
}
