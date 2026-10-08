import { findCard, takeCards } from '../cards'
import { classifyMeld, canLayOff } from './melds'
import { handDeadwood } from './score'
import { cloneRummy, currentPlayer, removeFromHand } from './state'
import type { RummyMove, RummyState } from './types'

export type RummyApplyResult = { ok: true; state: RummyState } | { ok: false; error: string }

function advanceTurn(state: RummyState): void {
  state.current = (state.current + 1) % state.players.length
  state.phase = 'draw'
  state.drew = false
}

function endRoundIfOut(state: RummyState): void {
  const me = currentPlayer(state)
  if (me.hand.length > 0) return
  state.phase = 'roundEnd'
  for (const pl of state.players) {
    if (pl.id === me.id) continue
    pl.score += handDeadwood(pl.hand, state.config)
  }
  state.log.push(`${me.name} went out.`)
  const target = state.config.playTo
  if (target != null && state.players.some((p) => p.score >= target)) {
    state.phase = 'matchEnd'
    const best = [...state.players].sort((a, b) => a.score - b.score)[0]
    state.winnerId = best?.id ?? me.id
    state.log.push('Match over — lowest score wins.')
  }
}

export function applyRummyMove(state: RummyState, move: RummyMove): RummyApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneRummy(state)
  const me = currentPlayer(next)

  if (move.t === 'drawStock') {
    if (next.phase !== 'draw' || next.drew) return { ok: false, error: 'Already drew' }
    if (next.stock.length === 0) {
      if (next.discard.length <= 1) return { ok: false, error: 'Stock empty' }
      const top = next.discard[next.discard.length - 1]!
      const rest = next.discard.slice(0, -1)
      next.stock = rest.reverse()
      next.discard = [top]
      next.log.push('Stock recycled from discard.')
    }
    const card = next.stock[0]
    if (!card) return { ok: false, error: 'Stock empty' }
    next.stock = next.stock.slice(1)
    me.hand.push(card)
    next.drew = true
    next.phase = 'meld'
    next.log.push(`${me.name} drew from stock.`)
    return { ok: true, state: next }
  }

  if (move.t === 'takeDiscard') {
    if (next.phase !== 'draw' || next.drew) return { ok: false, error: 'Already drew' }
    if (next.discard.length === 0) return { ok: false, error: 'Discard empty' }
    const card = next.discard.pop()!
    me.hand.push(card)
    next.drew = true
    next.phase = 'meld'
    next.log.push(`${me.name} took the discard.`)
    return { ok: true, state: next }
  }

  if (move.t === 'meld') {
    if (!next.drew || (next.phase !== 'meld' && next.phase !== 'discard')) {
      return { ok: false, error: 'Draw first' }
    }
    const { taken, rest, missing } = takeCards(me.hand, move.cardIds)
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    const kind = classifyMeld(taken)
    if (!kind) return { ok: false, error: 'Not a legal set or run' }
    me.hand = rest
    me.melds.push({
      id: `m${me.seat}-${me.melds.length}`,
      kind,
      cards: taken,
    })
    next.phase = 'meld'
    next.log.push(`${me.name} melded a ${kind}.`)
    endRoundIfOut(next)
    return { ok: true, state: next }
  }

  if (move.t === 'layoff') {
    if (!next.drew || (next.phase !== 'meld' && next.phase !== 'discard')) {
      return { ok: false, error: 'Draw first' }
    }
    const owner = next.players.find((p) => p.seat === move.meldOwnerSeat)
    if (!owner) return { ok: false, error: 'No such player' }
    const meld = owner.melds.find((m) => m.id === move.meldId)
    if (!meld) return { ok: false, error: 'No such meld' }
    const { taken, rest, missing } = takeCards(me.hand, move.cardIds)
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    const err = canLayOff(meld.cards, meld.kind, taken)
    if (err) return { ok: false, error: err }
    me.hand = rest
    meld.cards = [...meld.cards, ...taken]
    next.log.push(`${me.name} laid off on a ${meld.kind}.`)
    endRoundIfOut(next)
    return { ok: true, state: next }
  }

  if (move.t === 'discard') {
    if (!next.drew) return { ok: false, error: 'Draw first' }
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    const rem = removeFromHand(me, [move.cardId])
    if (rem) return { ok: false, error: rem }
    next.discard.push(card)
    next.log.push(`${me.name} discarded.`)
    endRoundIfOut(next)
    if (next.phase === 'roundEnd' || next.phase === 'matchEnd') {
      return { ok: true, state: next }
    }
    advanceTurn(next)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
