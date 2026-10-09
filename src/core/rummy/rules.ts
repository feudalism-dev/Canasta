import { findCard, takeCards } from '../cards'
import { classifyMeld, canLayOff } from './melds'
import { autoLayoffs, bestPartition, canKnockWithDiscard } from './partition'
import { handDeadwood } from './score'
import { cloneRummy, currentPlayer, removeFromHand } from './state'
import type { RummyMove, RummyPlayer, RummyState } from './types'

export type RummyApplyResult = { ok: true; state: RummyState } | { ok: false; error: string }

function advanceTurn(state: RummyState): void {
  state.current = (state.current + 1) % state.players.length
  state.phase = 'draw'
  state.drew = false
}

function pickMatchWinner(state: RummyState, fallbackId: string): string {
  const sorted = [...state.players].sort((a, b) =>
    state.config.scoreAscending ? a.score - b.score : b.score - a.score,
  )
  return sorted[0]?.id ?? fallbackId
}

function maybeMatchEnd(state: RummyState, noteWinner: string): void {
  const target = state.config.playTo
  if (target == null || !state.players.some((p) => p.score >= target)) return
  state.phase = 'matchEnd'
  state.winnerId = pickMatchWinner(state, noteWinner)
  state.log.push(
    state.config.scoreAscending
      ? 'Match over — lowest score wins.'
      : 'Match over — highest score wins.',
  )
}

function endRoundIfOut(state: RummyState): void {
  const me = currentPlayer(state)
  if (me.hand.length > 0) return
  state.phase = 'roundEnd'
  state.lastHandNote = `${me.name} went out.`
  for (const pl of state.players) {
    if (pl.id === me.id) continue
    pl.score += handDeadwood(pl.hand, state.config)
  }
  state.log.push(`${me.name} went out.`)
  maybeMatchEnd(state, me.id)
}

function assignPartitionMelds(player: RummyPlayer, part: ReturnType<typeof bestPartition>): void {
  player.melds = part.melds.map((m, i) => ({
    id: `m${player.seat}-${i}`,
    kind: m.kind,
    cards: m.cards,
  }))
  player.hand = part.deadwood
}

function resolveGinKnock(state: RummyState, discardId: string): RummyApplyResult {
  const me = currentPlayer(state)
  const check = canKnockWithDiscard(me.hand, discardId, state.config)
  if (!check.ok) return check

  const card = findCard(me.hand, discardId)
  if (!card) return { ok: false, error: 'Card not in hand' }
  const rem = removeFromHand(me, [discardId])
  if (rem) return { ok: false, error: rem }
  state.discard.push(card)

  const knockerPart = check.partition
  const isGin = check.gin
  assignPartitionMelds(me, knockerPart)

  const opp = state.players.find((p) => p.id !== me.id)
  if (!opp) return { ok: false, error: 'Need two players' }

  let oppWorking = [...opp.hand]
  if (!isGin) {
    const laid = autoLayoffs(oppWorking, me.melds, state.config)
    oppWorking = laid.hand
    me.melds = laid.melds
    if (laid.laid.length) {
      state.log.push(`${opp.name} laid off ${laid.laid.length} card(s).`)
    }
  }

  const oppPart = bestPartition(oppWorking, state.config)
  assignPartitionMelds(opp, oppPart)

  const kDw = knockerPart.points
  const oDw = oppPart.points
  const ginBonus = state.config.ginBonus ?? 25
  const undercutBonus = state.config.undercutBonus ?? 25

  let note: string
  if (isGin) {
    const pts = oDw + ginBonus
    me.score += pts
    note = `${me.name} went gin (+${pts}: ${oDw} deadwood + ${ginBonus} gin).`
  } else if (oDw <= kDw) {
    const pts = kDw - oDw + undercutBonus
    opp.score += pts
    note = `${opp.name} undercut (+${pts}: ${kDw - oDw} + ${undercutBonus} undercut).`
  } else {
    const pts = oDw - kDw
    me.score += pts
    note = `${me.name} knocked (+${pts}: ${oDw} - ${kDw} deadwood).`
  }

  state.phase = 'roundEnd'
  state.lastHandNote = note
  state.log.push(note)
  maybeMatchEnd(state, me.id)
  return { ok: true, state }
}

function endGinStockDraw(state: RummyState): void {
  state.phase = 'roundEnd'
  state.lastHandNote = 'Stock closed — no score this hand.'
  state.log.push(state.lastHandNote)
}

export function applyRummyMove(state: RummyState, move: RummyMove): RummyApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneRummy(state)
  const me = currentPlayer(next)
  const isGin = next.config.variant === 'gin'

  if (move.t === 'drawStock') {
    if (next.phase !== 'draw' || next.drew) return { ok: false, error: 'Already drew' }
    if (isGin && next.stock.length <= 2) {
      endGinStockDraw(next)
      return { ok: true, state: next }
    }
    if (next.stock.length === 0) {
      if (isGin) {
        endGinStockDraw(next)
        return { ok: true, state: next }
      }
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
    if (isGin) return { ok: false, error: 'Gin keeps melds in hand until you knock' }
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
    if (isGin) return { ok: false, error: 'Gin layoffs happen automatically after a knock' }
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

  if (move.t === 'knock') {
    if (!isGin) return { ok: false, error: 'Knock is Gin only' }
    if (!next.drew) return { ok: false, error: 'Draw first' }
    return resolveGinKnock(next, move.cardId)
  }

  if (move.t === 'discard') {
    if (!next.drew) return { ok: false, error: 'Draw first' }
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    const rem = removeFromHand(me, [move.cardId])
    if (rem) return { ok: false, error: rem }
    next.discard.push(card)
    next.log.push(`${me.name} discarded.`)
    if (!isGin) endRoundIfOut(next)
    if (next.phase === 'roundEnd' || next.phase === 'matchEnd') {
      return { ok: true, state: next }
    }
    if (isGin && next.stock.length <= 2) {
      endGinStockDraw(next)
      return { ok: true, state: next }
    }
    advanceTurn(next)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
