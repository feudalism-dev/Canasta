import { cardPoints, isSkip, isWild } from '../core/phaseit/deck'
import { canHitMeld, findPhaseGroups } from '../core/phaseit/melds'
import { phaseDef } from '../core/phaseit/phases'
import { applyPhaseItMove } from '../core/phaseit/rules'
import { currentPlayer, topDiscard } from '../core/phaseit/state'
import type { PhaseItMove, PhaseItState } from '../core/phaseit/types'

function pickDraw(state: PhaseItState): PhaseItMove {
  const top = topDiscard(state)
  const me = currentPlayer(state)
  if (top && !isSkip(top)) {
    // Take discard if it helps current phase or is a low point number we might need
    if (!me.phaseDown && me.phase < 10) {
      const trial = [...me.hand, top]
      const groups = findPhaseGroups(trial, phaseDef(me.phase).parts)
      if (groups) return { t: 'drawDiscard' }
    }
    if (me.phaseDown) {
      for (const pl of state.players) {
        if (!pl.phaseDown) continue
        for (const meld of pl.laid) {
          if (canHitMeld(meld, top)) return { t: 'drawDiscard' }
        }
      }
    }
  }
  return { t: 'drawStock' }
}

function pickHit(state: PhaseItState): PhaseItMove | null {
  const me = currentPlayer(state)
  if (!me.phaseDown) return null
  // Prefer hitting with high-point cards, then wilds last
  const ranked = [...me.hand].sort((a, b) => cardPoints(b) - cardPoints(a))
  for (const card of ranked) {
    if (isSkip(card)) continue
    for (let ti = 0; ti < state.players.length; ti++) {
      const target = state.players[ti]!
      if (!target.phaseDown) continue
      for (let mi = 0; mi < target.laid.length; mi++) {
        if (canHitMeld(target.laid[mi]!, card)) {
          return { t: 'hit', cardId: card.id, target: ti, meldIndex: mi }
        }
      }
    }
  }
  return null
}

function pickDiscard(state: PhaseItState): PhaseItMove {
  const me = currentPlayer(state)
  // Prefer discarding Skip to punish, then high points, keep wilds
  const ranked = [...me.hand].sort((a, b) => {
    const sa = isSkip(a) ? 0 : isWild(a) ? 2 : 1
    const sb = isSkip(b) ? 0 : isWild(b) ? 2 : 1
    if (sa !== sb) return sa - sb
    return cardPoints(b) - cardPoints(a)
  })
  // If we have a skip and more than one card, dump it
  const skip = ranked.find(isSkip)
  if (skip && me.hand.length > 1) return { t: 'discard', cardId: skip.id }
  const card = ranked.find((c) => !isWild(c)) ?? ranked[0]!
  return { t: 'discard', cardId: card.id }
}

export function pickPhaseItBotMove(state: PhaseItState): PhaseItMove | null {
  if (state.phase !== 'play') return null
  const me = currentPlayer(state)
  if (!me.isComputer) return null

  if (!state.hasDrawn) return pickDraw(state)

  if (!me.phaseDown && me.phase < 10) {
    const groups = findPhaseGroups(me.hand, phaseDef(me.phase).parts)
    if (groups) return { t: 'layPhase', groups }
  }

  const hit = pickHit(state)
  if (hit) return hit

  return pickDiscard(state)
}

export function stepPhaseItBot(state: PhaseItState): PhaseItState | null {
  const move = pickPhaseItBotMove(state)
  if (!move) return null
  const res = applyPhaseItMove(state, move)
  return res.ok ? res.state : null
}

const THINK_MS_MIN = 1200
const THINK_MS_MAX = 2000

function thinkDelayMs(): number {
  return THINK_MS_MIN + Math.floor(Math.random() * (THINK_MS_MAX - THINK_MS_MIN + 1))
}

export async function pumpPhaseItBots(
  state: PhaseItState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: PhaseItState) => void
    getState?: () => PhaseItState
  },
): Promise<PhaseItState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      if (cur.phase !== 'play') break
      if (!cur.players[cur.current]?.isComputer) break

      await new Promise((r) => window.setTimeout(r, thinkDelayMs()))
      if (opts.isCancelled()) break
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      if (!cur.players[cur.current]?.isComputer) break

      const next = stepPhaseItBot(cur)
      if (!next) break
      cur = next
      opts.onStep(cur)
    }
  } finally {
    opts.onThinking(false)
  }
  return cur
}
