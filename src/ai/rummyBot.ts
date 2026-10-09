import { classifyMeld, layoffTargets } from '../core/rummy/melds'
import { canKnockWithDiscard } from '../core/rummy/partition'
import { applyRummyMove } from '../core/rummy/rules'
import { deadwoodPoints } from '../core/rummy/score'
import { cloneRummy, currentPlayer } from '../core/rummy/state'
import type { RummyMove, RummyState } from '../core/rummy/types'
import { isGinStyle } from '../core/rummy/variants'

/** Prefer discarding high deadwood; never discard a Kalooki joker. */
function discardPick(state: RummyState): string | null {
  const me = currentPlayer(state)
  if (me.hand.length === 0) return null
  let best: (typeof me.hand)[0] | null = null
  let bestScore = -1
  for (const c of me.hand) {
    if (state.config.variant === 'kalooki' && c.rank === 'JOKER') continue
    const pts = deadwoodPoints(c, state.config)
    if (pts > bestScore) {
      bestScore = pts
      best = c
    }
  }
  return best?.id ?? me.hand.find((c) => c.rank !== 'JOKER')?.id ?? me.hand[0]!.id
}

/** Try every 3–4 card combo for a legal meld (small hands — fine for 7–14 cards). */
function findMeldIds(state: RummyState, requireId?: string | null): string[] | null {
  const me = currentPlayer(state)
  const hand = me.hand
  const n = hand.length
  if (n < 3) return null
  for (let len = Math.min(4, n); len >= 3; len--) {
    const idx: number[] = []
    const walk = (start: number, need: number): string[] | null => {
      if (need === 0) {
        const ids = idx.map((i) => hand[i]!.id)
        if (requireId && !ids.includes(requireId)) return null
        const cards = idx.map((i) => hand[i]!)
        if (classifyMeld(cards, state.config)) return ids
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
  // Longer runs (5+) for kalooki / 500
  if (n >= 5) {
    for (let len = Math.min(n, 8); len >= 5; len--) {
      const idx: number[] = []
      const walk = (start: number, need: number): string[] | null => {
        if (need === 0) {
          const ids = idx.map((i) => hand[i]!.id)
          if (requireId && !ids.includes(requireId)) return null
          const cards = idx.map((i) => hand[i]!)
          if (classifyMeld(cards, state.config) === 'run') return ids
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
  }
  return null
}

/** Best knock discard: prefer gin, else lowest remaining deadwood. */
function knockPick(state: RummyState): { cardId: string; gin: boolean; points: number } | null {
  const me = currentPlayer(state)
  let best: { cardId: string; gin: boolean; points: number } | null = null
  for (const c of me.hand) {
    const check = canKnockWithDiscard(me.hand, c.id, state.config)
    if (!check.ok) continue
    const cand = { cardId: c.id, gin: check.gin, points: check.partition.points }
    if (
      !best ||
      (cand.gin && !best.gin) ||
      (cand.gin === best.gin && cand.points < best.points)
    ) {
      best = cand
    }
  }
  return best
}

function canUseCardThisTurn(state: RummyState, cardId: string): boolean {
  const meld = findMeldIds(state, cardId)
  if (meld) return true
  const me = currentPlayer(state)
  const card = me.hand.find((c) => c.id === cardId)
  if (!card) return false
  return layoffTargets(state.players, [card], state.config).length > 0
}

/** One legal computer action for the current player, or null if not a computer's turn. */
export function pickRummyBotMove(state: RummyState): RummyMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null
  const ginStyle = isGinStyle(state.config.variant)

  if (!state.drew || state.phase === 'draw') {
    if (state.config.deepDiscard && state.discard.length > 0) {
      // Prefer deeper takes when the buried card can be used immediately.
      for (let i = 0; i < state.discard.length; i++) {
        const trial = cloneRummy(state)
        const take = applyRummyMove(trial, { t: 'takeDiscardDeep', fromIndex: i })
        if (!take.ok) continue
        const must = take.state.mustUseCardId
        if (must && canUseCardThisTurn(take.state, must)) {
          return { t: 'takeDiscardDeep', fromIndex: i }
        }
      }
    } else if (state.discard.length > 0) {
      const trial = cloneRummy(state)
      const take = applyRummyMove(trial, { t: 'takeDiscard' })
      if (take.ok) {
        if (ginStyle) {
          const knock = knockPick(take.state)
          if (knock && (knock.gin || knock.points <= 5)) return { t: 'takeDiscard' }
        } else if (findMeldIds(take.state)) {
          return { t: 'takeDiscard' }
        } else {
          const top = state.discard[state.discard.length - 1]
          if (top && layoffTargets(take.state.players, [top], take.state.config).length) {
            return { t: 'takeDiscard' }
          }
        }
      }
    }
    return { t: 'drawStock' }
  }

  if (ginStyle) {
    const knock = knockPick(state)
    if (knock && (knock.gin || knock.points <= 8)) {
      return { t: 'knock', cardId: knock.cardId }
    }
    const cardId = discardPick(state)
    if (cardId) return { t: 'discard', cardId }
    return null
  }

  if (state.mustUseCardId) {
    const meldMust = findMeldIds(state, state.mustUseCardId)
    if (meldMust) return { t: 'meld', cardIds: meldMust }
    const mustCard = me.hand.find((c) => c.id === state.mustUseCardId)
    if (mustCard) {
      const hits = layoffTargets(state.players, [mustCard], state.config)
      if (hits[0]) {
        return {
          t: 'layoff',
          meldOwnerSeat: hits[0].seat,
          meldId: hits[0].meldId,
          cardIds: [mustCard.id],
        }
      }
    }
  }

  const meldIds = findMeldIds(state)
  if (meldIds) return { t: 'meld', cardIds: meldIds }

  for (const c of me.hand) {
    const hits = layoffTargets(state.players, [c], state.config)
    if (hits[0]) {
      return {
        t: 'layoff',
        meldOwnerSeat: hits[0].seat,
        meldId: hits[0].meldId,
        cardIds: [c.id],
      }
    }
  }

  if (state.mustUseCardId) return null

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
