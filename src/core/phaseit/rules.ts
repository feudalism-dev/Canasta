import { isSkip, sortPhaseItHand } from './deck'
import { hitMeld, matchPhaseGroups } from './melds'
import { phaseDef, phaseLabel } from './phases'
import { scorePhaseItHand } from './score'
import { clonePhaseIt, drawFromStock, topDiscard } from './state'
import type { PhaseItMove, PhaseItState } from './types'

export type PhaseItApplyResult =
  | { ok: true; state: PhaseItState }
  | { ok: false; error: string }

function nextIndex(state: PhaseItState, from: number, steps = 1): number {
  const n = state.players.length
  return (from + steps + n * 4) % n
}

function advance(state: PhaseItState, from: number, skipNext = false): void {
  state.current = nextIndex(state, from, skipNext ? 2 : 1)
  state.hasDrawn = false
  const cur = state.players[state.current]!
  state.lastMessage = `${cur.name}'s turn · ${phaseLabel(cur.phase)}`
}

export function applyPhaseItMove(state: PhaseItState, move: PhaseItMove): PhaseItApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = clonePhaseIt(state)
  const me = next.current
  const pl = next.players[me]!

  if (move.t === 'drawStock') {
    if (next.hasDrawn) return { ok: false, error: 'Already drew' }
    if (!next.stock.length && next.discard.length <= 1) {
      return { ok: false, error: 'Nothing to draw' }
    }
    drawFromStock(next, me)
    next.hasDrawn = true
    next.log.push(`${pl.name} draws from stock.`)
    next.lastMessage = next.log[next.log.length - 1]!
    return { ok: true, state: next }
  }

  if (move.t === 'drawDiscard') {
    if (next.hasDrawn) return { ok: false, error: 'Already drew' }
    const top = topDiscard(next)
    if (!top) return { ok: false, error: 'Discard empty' }
    if (isSkip(top)) return { ok: false, error: 'Cannot take a Skip' }
    next.discard = next.discard.slice(0, -1)
    pl.hand = sortPhaseItHand([...pl.hand, top])
    next.hasDrawn = true
    next.log.push(`${pl.name} takes the discard.`)
    next.lastMessage = next.log[next.log.length - 1]!
    return { ok: true, state: next }
  }

  if (move.t === 'layPhase') {
    if (!next.hasDrawn) return { ok: false, error: 'Draw first' }
    if (pl.phaseDown) return { ok: false, error: 'Phase already down' }
    if (pl.phase >= 10) return { ok: false, error: 'All phases done' }
    const def = phaseDef(pl.phase)
    const groups = move.groups.map((ids) => {
      const cards = ids.map((id) => pl.hand.find((c) => c.id === id)).filter(Boolean)
      return cards as typeof pl.hand
    })
    if (groups.some((g, i) => g.length !== move.groups[i]!.length)) {
      return { ok: false, error: 'Cards not in hand' }
    }
    const used = new Set(move.groups.flat())
    if (used.size !== move.groups.flat().length) return { ok: false, error: 'Duplicate cards' }
    const melds = matchPhaseGroups(groups, def.parts)
    if (!melds) return { ok: false, error: `Does not complete ${def.label}` }
    pl.hand = sortPhaseItHand(pl.hand.filter((c) => !used.has(c.id)))
    pl.laid = melds
    pl.phaseDown = true
    next.log.push(`${pl.name} lays Phase ${pl.phase + 1}: ${def.label}.`)
    next.lastMessage = next.log[next.log.length - 1]!
    if (pl.hand.length === 0) {
      scorePhaseItHand(next, me)
      return { ok: true, state: next }
    }
    return { ok: true, state: next }
  }

  if (move.t === 'hit') {
    if (!next.hasDrawn) return { ok: false, error: 'Draw first' }
    if (!pl.phaseDown) return { ok: false, error: 'Lay your phase first' }
    const card = pl.hand.find((c) => c.id === move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    const target = next.players[move.target]
    if (!target?.phaseDown) return { ok: false, error: 'No melds there' }
    const meld = target.laid[move.meldIndex]
    if (!meld) return { ok: false, error: 'Bad meld' }
    const updated = hitMeld(meld, card)
    if (!updated) return { ok: false, error: 'Cannot hit that meld' }
    target.laid[move.meldIndex] = updated
    pl.hand = sortPhaseItHand(pl.hand.filter((c) => c.id !== card.id))
    next.log.push(`${pl.name} hits on ${target.name}'s meld.`)
    next.lastMessage = next.log[next.log.length - 1]!
    if (pl.hand.length === 0) {
      scorePhaseItHand(next, me)
      return { ok: true, state: next }
    }
    return { ok: true, state: next }
  }

  if (move.t === 'discard') {
    if (!next.hasDrawn) return { ok: false, error: 'Draw first' }
    const card = pl.hand.find((c) => c.id === move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    pl.hand = sortPhaseItHand(pl.hand.filter((c) => c.id !== card.id))
    next.discard.push(card)
    next.log.push(`${pl.name} discards ${card.kind === 'wild' ? 'WILD' : card.kind}.`)
    if (pl.hand.length === 0) {
      if (!pl.phaseDown) {
        // Can't go out without phase down — shouldn't empty without phase except theoretically
        return { ok: false, error: 'Must lay phase before going out' }
      }
      scorePhaseItHand(next, me)
      return { ok: true, state: next }
    }
    const skip = isSkip(card)
    if (skip) next.log.push(`${next.players[nextIndex(next, me)]!.name} is skipped.`)
    advance(next, me, skip)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
