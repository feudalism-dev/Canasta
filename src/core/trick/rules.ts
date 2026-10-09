import { findCard, takeCards } from '../cards'
import type { Card } from '../cards'
import {
  cardPenalty,
  isHeart,
  isQueenOfSpades,
  sortTrickHand,
  trickRankValue,
} from './deck'
import {
  cloneTrick,
  currentPlayer,
  indexWithTwoOfClubs,
  removeFromHand,
} from './state'
import type { TrickHandScoreLine, TrickMove, TrickState } from './types'

export type TrickApplyResult = { ok: true; state: TrickState } | { ok: false; error: string }

function passTargetIndex(from: number, dir: TrickState['passDirection']): number {
  if (dir === 'left') return (from + 1) % 4
  if (dir === 'right') return (from + 3) % 4
  if (dir === 'across') return (from + 2) % 4
  return from
}

export function legalPlays(state: TrickState, playerIndex: number): Card[] {
  const pl = state.players[playerIndex]
  if (!pl) return []
  const hand = pl.hand
  if (state.phase !== 'play') return []

  const tricksDone = state.tricksTaken.reduce((a, b) => a + b, 0)
  if (tricksDone === 0 && state.trick.length === 0) {
    const two = hand.find((c) => c.suit === 'C' && c.rank === '2')
    return two ? [two] : []
  }

  if (state.trick.length === 0) {
    if (!state.heartsBroken) {
      const nonHearts = hand.filter((c) => !isHeart(c))
      if (nonHearts.length) return nonHearts
    }
    return [...hand]
  }

  const led = state.trick[0]!.card.suit
  const follow = hand.filter((c) => c.suit === led)
  if (follow.length) return follow

  if (tricksDone === 0) {
    const safe = hand.filter((c) => !isHeart(c) && !isQueenOfSpades(c))
    if (safe.length) return safe
  }
  return [...hand]
}

function winnerOfTrick(
  trick: { seat: number; card: Card }[],
  state: TrickState,
): number {
  const ledSuit = trick[0]!.card.suit
  let best = trick[0]!
  for (const play of trick.slice(1)) {
    if (play.card.suit !== ledSuit) continue
    if (trickRankValue(play.card.rank) > trickRankValue(best.card.rank)) best = play
  }
  const idx = state.players.findIndex((p) => p.seat === best.seat)
  return idx >= 0 ? idx : 0
}

function scoreHand(state: TrickState): void {
  const taken = state.players.map((p) => p.takenThisHand)
  const moon = Boolean(state.config.shootTheMoon && taken.some((t) => t === 26))
  const deltas = new Map<string, number>()
  const parts: string[] = []

  if (moon) {
    const shooter = state.players.findIndex((p) => p.takenThisHand === 26)
    for (let i = 0; i < state.players.length; i++) {
      const pl = state.players[i]!
      const delta = i === shooter ? 0 : 26
      pl.score += delta
      deltas.set(pl.id, delta)
      parts.push(`${pl.name} +${delta}`)
    }
    state.lastHandNote = `${state.players[shooter]!.name} shot the moon — ${parts.join(', ')}`
  } else {
    for (const pl of state.players) {
      const delta = pl.takenThisHand
      pl.score += delta
      deltas.set(pl.id, delta)
      parts.push(`${pl.name} +${delta}`)
    }
    state.lastHandNote = `Hand scored — ${parts.join(', ')}`
  }

  state.lastHandScores = state.players.map(
    (p): TrickHandScoreLine => ({
      playerId: p.id,
      name: p.name,
      delta: deltas.get(p.id) ?? 0,
      total: p.score,
    }),
  )
  state.log.push(state.lastHandNote)
  state.phase = 'roundEnd'

  const target = state.config.playTo
  if (target != null && state.players.some((p) => p.score >= target)) {
    state.phase = 'matchEnd'
    const sorted = [...state.players].sort((a, b) => a.score - b.score)
    state.winnerId = sorted[0]!.id
    state.log.push(`Match over — ${sorted[0]!.name} wins with ${sorted[0]!.score}.`)
  }
}

function finishTrick(state: TrickState): void {
  const winnerIdx = winnerOfTrick(state.trick, state)
  const winner = state.players[winnerIdx]!
  let pts = 0
  for (const play of state.trick) {
    pts += cardPenalty(play.card)
    if (isHeart(play.card)) state.heartsBroken = true
  }
  winner.takenThisHand += pts
  state.tricksTaken[winnerIdx] = (state.tricksTaken[winnerIdx] ?? 0) + 1
  const tricks = state.tricksTaken[winnerIdx] ?? 0
  const note =
    pts > 0
      ? `${winner.name} took the trick (+${pts} pts) · ${tricks} trick${tricks === 1 ? '' : 's'} this hand`
      : `${winner.name} took the trick · ${tricks} trick${tricks === 1 ? '' : 's'} this hand`
  state.lastTrickNote = note
  state.log.push(note)
  state.trick = []
  state.trickLeader = winnerIdx
  state.current = winnerIdx

  const cardsLeft = state.players.reduce((n, p) => n + p.hand.length, 0)
  if (cardsLeft === 0) scoreHand(state)
}

export function applyTrickMove(state: TrickState, move: TrickMove): TrickApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneTrick(state)

  if (move.t === 'pass') {
    if (next.phase !== 'pass') return { ok: false, error: 'Not a pass hand' }
    if (next.passDirection === 'hold') return { ok: false, error: 'No pass this hand' }
    if (next.passed[next.current]) return { ok: false, error: 'Already passed' }
    if (move.cardIds.length !== 3) return { ok: false, error: 'Pass exactly three cards' }
    const me = currentPlayer(next)
    const { taken, rest, missing } = takeCards(me.hand, move.cardIds)
    if (missing.length || taken.length !== 3) return { ok: false, error: 'Card not in hand' }
    me.hand = sortTrickHand(rest)
    next.passQueue[next.current] = taken
    next.passed[next.current] = true
    next.log.push(`${me.name} selected three cards to pass ${next.passDirection}.`)

    let guard = 0
    do {
      next.current = (next.current + 1) % 4
      guard += 1
    } while (next.passed[next.current] && guard < 4)

    if (next.passed.every(Boolean)) {
      for (let i = 0; i < 4; i++) {
        const dest = passTargetIndex(i, next.passDirection)
        const gift = next.passQueue[i]
        if (!gift) continue
        next.players[dest]!.hand = sortTrickHand([...next.players[dest]!.hand, ...gift])
      }
      next.passQueue = [null, null, null, null]
      next.phase = 'play'
      next.trickLeader = indexWithTwoOfClubs(next)
      next.current = next.trickLeader
      next.log.push(`Pass complete — ${next.players[next.trickLeader]!.name} leads with 2♣.`)
    }
    return { ok: true, state: next }
  }

  if (move.t === 'play') {
    if (next.phase !== 'play') return { ok: false, error: 'Not in play' }
    const me = currentPlayer(next)
    const legal = legalPlays(next, next.current)
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    if (!legal.some((c) => c.id === card.id)) {
      return { ok: false, error: 'Illegal play' }
    }
    const rem = removeFromHand(me, [move.cardId])
    if (rem) return { ok: false, error: rem }
    next.trick.push({ seat: me.seat, card })
    if (isHeart(card)) next.heartsBroken = true
    if (next.trick.length === 1) next.lastTrickNote = null
    next.log.push(`${me.name} played ${card.rank}${card.suit}.`)

    if (next.trick.length >= 4) {
      finishTrick(next)
    } else {
      next.current = (next.current + 1) % 4
    }
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
