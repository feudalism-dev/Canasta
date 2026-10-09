import { findCard, takeCards } from '../cards'
import { classifyMeld, canLayOff, orderMeldCards } from './melds'
import { autoLayoffs, bestPartition, canKnockWithDiscard } from './partition'
import { cardsPoints, handDeadwood } from './score'
import { cloneRummy, currentPlayer, removeFromHand } from './state'
import type { RummyHandScoreLine, RummyMove, RummyPlayer, RummyState } from './types'
import { isGinStyle } from './variants'

export type RummyApplyResult = { ok: true; state: RummyState } | { ok: false; error: string }

function scoreLinesFromDeltas(state: RummyState, deltas: Map<string, number>): RummyHandScoreLine[] {
  return state.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    delta: deltas.get(p.id) ?? 0,
    total: p.score,
  }))
}

function advanceTurn(state: RummyState): void {
  state.current = (state.current + 1) % state.players.length
  state.phase = 'draw'
  state.drew = false
  state.mustUseCardId = null
}

function pickMatchWinner(state: RummyState, fallbackId: string): string {
  const sorted = [...state.players].sort((a, b) =>
    state.config.scoreAscending ? a.score - b.score : b.score - a.score,
  )
  return sorted[0]?.id ?? fallbackId
}

function maybeMatchEnd(state: RummyState, noteWinner: string): void {
  const handsCap = state.config.handsPerMatch
  if (handsCap != null && state.round >= handsCap) {
    state.phase = 'matchEnd'
    state.winnerId = pickMatchWinner(state, noteWinner)
    state.log.push(
      state.config.scoreAscending
        ? `Match over after ${handsCap} hands — lowest score wins.`
        : `Match over after ${handsCap} hands — highest score wins.`,
    )
    return
  }
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

function clearMustUse(state: RummyState, cardIds: string[]): void {
  if (state.mustUseCardId && cardIds.includes(state.mustUseCardId)) {
    state.mustUseCardId = null
  }
}

function endRoundMeldScoring(state: RummyState, notePrefix: string): void {
  state.phase = 'roundEnd'
  const layoffOwner = new Map<string, string>()
  for (const pl of state.players) {
    for (const c of pl.scoredLayoffs) layoffOwner.set(c.id, pl.id)
  }
  const deltas = new Map<string, number>()
  const parts: string[] = []
  for (const pl of state.players) {
    let meldPts = 0
    for (const m of pl.melds) {
      for (const c of m.cards) {
        const scorer = layoffOwner.get(c.id)
        if (scorer && scorer !== pl.id) continue
        meldPts += cardsPoints([c], state.config)
      }
    }
    const layPts = cardsPoints(pl.scoredLayoffs, state.config)
    const handPts = handDeadwood(pl.hand, state.config)
    const delta = meldPts + layPts - handPts
    pl.score += delta
    deltas.set(pl.id, delta)
    parts.push(`${pl.name} ${delta >= 0 ? '+' : ''}${delta}`)
  }
  state.lastHandScores = scoreLinesFromDeltas(state, deltas)
  state.lastHandNote = `${notePrefix} ${parts.join(', ')}`
  state.log.push(state.lastHandNote)
  maybeMatchEnd(state, state.players[0]!.id)
}

function endRoundIfOut(state: RummyState): void {
  const me = currentPlayer(state)
  if (me.hand.length > 0) return
  if (state.config.meldScoring) {
    endRoundMeldScoring(state, `${me.name} went out —`)
    return
  }
  state.phase = 'roundEnd'
  const deltas = new Map<string, number>()
  deltas.set(me.id, 0)
  const parts: string[] = []
  for (const pl of state.players) {
    if (pl.id === me.id) continue
    const dw = handDeadwood(pl.hand, state.config)
    pl.score += dw
    deltas.set(pl.id, dw)
    parts.push(`${pl.name} +${dw}`)
  }
  state.lastHandScores = scoreLinesFromDeltas(state, deltas)
  state.lastHandNote =
    parts.length > 0 ? `${me.name} went out — ${parts.join(', ')}` : `${me.name} went out.`
  state.log.push(state.lastHandNote)
  maybeMatchEnd(state, me.id)
}

function assignPartitionMelds(player: RummyPlayer, part: ReturnType<typeof bestPartition>): void {
  player.melds = part.melds.map((m, i) => ({
    id: `m${player.seat}-${i}`,
    kind: m.kind,
    cards: orderMeldCards(m.kind, m.cards),
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
  const wentGin = check.gin
  assignPartitionMelds(me, knockerPart)

  const opp = state.players.find((p) => p.id !== me.id)
  if (!opp) return { ok: false, error: 'Need two players' }

  let oppWorking = [...opp.hand]
  if (!wentGin) {
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
  const mult = state.scoreMultThisHand || 1

  const deltas = new Map<string, number>()
  deltas.set(me.id, 0)
  deltas.set(opp.id, 0)
  let note: string
  if (wentGin) {
    const pts = (oDw + ginBonus) * mult
    me.score += pts
    deltas.set(me.id, pts)
    note = `${me.name} went gin (+${pts}${mult > 1 ? ' ×2 spades' : ''}).`
  } else if (oDw <= kDw) {
    const pts = (kDw - oDw + undercutBonus) * mult
    opp.score += pts
    deltas.set(opp.id, pts)
    note = `${opp.name} undercut (+${pts}${mult > 1 ? ' ×2 spades' : ''}).`
  } else {
    const pts = (oDw - kDw) * mult
    me.score += pts
    deltas.set(me.id, pts)
    note = `${me.name} knocked (+${pts}${mult > 1 ? ' ×2 spades' : ''}).`
  }

  state.phase = 'roundEnd'
  state.lastHandNote = note
  state.lastHandScores = scoreLinesFromDeltas(state, deltas)
  state.log.push(note)
  maybeMatchEnd(state, me.id)
  return { ok: true, state }
}

function endStockExhausted(state: RummyState, note: string): void {
  if (state.config.meldScoring) {
    endRoundMeldScoring(state, 'Stock empty —')
    return
  }
  state.phase = 'roundEnd'
  state.lastHandNote = note
  state.lastHandScores = scoreLinesFromDeltas(state, new Map())
  state.log.push(note)
  maybeMatchEnd(state, state.players[0]!.id)
}

export function applyRummyMove(state: RummyState, move: RummyMove): RummyApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneRummy(state)
  const me = currentPlayer(next)
  const ginStyle = isGinStyle(next.config.variant)

  if (move.t === 'drawStock') {
    if (next.phase !== 'draw' || next.drew) return { ok: false, error: 'Already drew' }
    if (ginStyle && next.stock.length <= 2) {
      endStockExhausted(next, 'Stock closed — no score this hand.')
      return { ok: true, state: next }
    }
    if (next.stock.length === 0) {
      endStockExhausted(next, 'Stock empty — hand is a draw (no score).')
      return { ok: true, state: next }
    }
    const card = next.stock[0]
    if (!card) {
      endStockExhausted(next, 'Stock empty — hand is a draw (no score).')
      return { ok: true, state: next }
    }
    next.stock = next.stock.slice(1)
    me.hand.push(card)
    next.drew = true
    next.phase = 'meld'
    next.mustUseCardId = null
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
    // Rummy 500: even the top card must be melded/laid off this turn.
    next.mustUseCardId = next.config.deepDiscard ? card.id : null
    next.log.push(`${me.name} took the discard.`)
    return { ok: true, state: next }
  }

  if (move.t === 'takeDiscardDeep') {
    if (!next.config.deepDiscard) return { ok: false, error: 'Deep discard is Rummy 500 only' }
    if (next.phase !== 'draw' || next.drew) return { ok: false, error: 'Already drew' }
    if (move.fromIndex < 0 || move.fromIndex >= next.discard.length) {
      return { ok: false, error: 'Invalid discard index' }
    }
    const taken = next.discard.slice(move.fromIndex)
    next.discard = next.discard.slice(0, move.fromIndex)
    const must = taken[0]!
    me.hand.push(...taken)
    next.drew = true
    next.phase = 'meld'
    next.mustUseCardId = must.id
    next.log.push(
      taken.length === 1
        ? `${me.name} took the discard.`
        : `${me.name} took ${taken.length} from the discard (must meld ${must.rank}).`,
    )
    return { ok: true, state: next }
  }

  if (move.t === 'meld') {
    if (ginStyle) return { ok: false, error: 'Gin keeps melds in hand until you knock' }
    if (!next.drew || (next.phase !== 'meld' && next.phase !== 'discard')) {
      return { ok: false, error: 'Draw first' }
    }
    const { taken, rest, missing } = takeCards(me.hand, move.cardIds)
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    if (next.mustUseCardId && !move.cardIds.includes(next.mustUseCardId)) {
      return { ok: false, error: 'Must meld the card taken from the discard' }
    }
    const kind = classifyMeld(taken, next.config)
    if (!kind) return { ok: false, error: 'Not a legal set or run' }
    me.hand = rest
    me.melds.push({
      id: `m${me.seat}-${me.melds.length}`,
      kind,
      cards: orderMeldCards(kind, taken),
    })
    clearMustUse(next, move.cardIds)
    next.phase = 'meld'
    next.log.push(`${me.name} melded a ${kind}.`)
    endRoundIfOut(next)
    return { ok: true, state: next }
  }

  if (move.t === 'layoff') {
    if (ginStyle) return { ok: false, error: 'Gin layoffs happen automatically after a knock' }
    if (!next.drew || (next.phase !== 'meld' && next.phase !== 'discard')) {
      return { ok: false, error: 'Draw first' }
    }
    const owner = next.players.find((p) => p.seat === move.meldOwnerSeat)
    if (!owner) return { ok: false, error: 'No such player' }
    const meld = owner.melds.find((m) => m.id === move.meldId)
    if (!meld) return { ok: false, error: 'No such meld' }
    const { taken, rest, missing } = takeCards(me.hand, move.cardIds)
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    if (next.mustUseCardId && !move.cardIds.includes(next.mustUseCardId)) {
      return { ok: false, error: 'Must lay off the card taken from the discard' }
    }
    const err = canLayOff(meld.cards, meld.kind, taken, next.config)
    if (err) return { ok: false, error: err }
    me.hand = rest
    meld.cards = orderMeldCards(meld.kind, [...meld.cards, ...taken])
    if (next.config.meldScoring && owner.id !== me.id) {
      me.scoredLayoffs.push(...taken)
    }
    clearMustUse(next, move.cardIds)
    next.log.push(`${me.name} laid off on a ${meld.kind}.`)
    endRoundIfOut(next)
    return { ok: true, state: next }
  }

  if (move.t === 'knock') {
    if (!ginStyle) return { ok: false, error: 'Knock is Gin / Oklahoma only' }
    if (!next.drew) return { ok: false, error: 'Draw first' }
    return resolveGinKnock(next, move.cardId)
  }

  if (move.t === 'discard') {
    if (!next.drew) return { ok: false, error: 'Draw first' }
    if (next.mustUseCardId) {
      return { ok: false, error: 'Meld or lay off the taken discard card first' }
    }
    if (next.config.variant === 'kalooki' && findCard(me.hand, move.cardId)?.rank === 'JOKER') {
      return { ok: false, error: 'Cannot discard a joker in Kalooki' }
    }
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    const rem = removeFromHand(me, [move.cardId])
    if (rem) return { ok: false, error: rem }
    next.discard.push(card)
    next.log.push(`${me.name} discarded.`)
    if (!ginStyle) endRoundIfOut(next)
    if (next.phase === 'roundEnd' || next.phase === 'matchEnd') {
      return { ok: true, state: next }
    }
    if (ginStyle && next.stock.length <= 2) {
      endStockExhausted(next, 'Stock closed — no score this hand.')
      return { ok: true, state: next }
    }
    if (!ginStyle && next.stock.length === 0) {
      endStockExhausted(next, 'Stock empty — hand is a draw (no score).')
      return { ok: true, state: next }
    }
    advanceTurn(next)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
