import { findCard, takeCards } from '../cards'
import type { Card } from '../cards'
import {
  cardPenalty,
  isHeart,
  isQueenOfSpades,
  sortTrickHand,
  trickRankValue,
} from './deck'
import { applyEuchreMove, legalEuchrePlays } from './euchreRules'
import { applyOhHellMove, legalOhHellPlays } from './ohHellRules'
import { applyRoosterMove, legalRoosterPlays } from './roosterRules'
import { applySpadesMove, legalSpadesPlays } from './spadesRules'
import {
  cloneTrick,
  currentPlayer,
  indexWithLeadCard,
  removeFromHand,
} from './state'
import type { TrickHandScoreLine, TrickMove, TrickState } from './types'

export type TrickApplyResult = { ok: true; state: TrickState } | { ok: false; error: string }

function nPlayers(state: TrickState): number {
  return state.players.length
}

function passTargetIndex(from: number, dir: TrickState['passDirection'], n: number): number {
  if (dir === 'left') return (from + 1) % n
  if (dir === 'right') return (from + n - 1) % n
  if (dir === 'across') return (from + Math.floor(n / 2)) % n
  return from
}

export function legalPlays(state: TrickState, playerIndex: number): Card[] {
  if (state.config.variant === 'rooster') return legalRoosterPlays(state, playerIndex)
  if (state.config.variant === 'spades') return legalSpadesPlays(state, playerIndex)
  if (state.config.variant === 'euchre') return legalEuchrePlays(state, playerIndex)
  if (state.config.variant === 'ohhell') return legalOhHellPlays(state, playerIndex)
  const pl = state.players[playerIndex]
  if (!pl) return []
  const hand = pl.hand
  if (state.phase !== 'play') return []

  const tricksDone = state.tricksTaken.reduce((a, b) => a + b, 0)
  if (tricksDone === 0 && state.trick.length === 0) {
    const two = hand.find((c) => c.suit === 'C' && c.rank === '2')
    if (two) return [two]
    // 2♣ not in this player's hand (or not dealt) — only the designated leader may act;
    // they may lead any legal lead card.
  }

  if (state.trick.length === 0) {
    if (tricksDone === 0) {
      // Opening lead: only the lead player should be current; allow clubs preference already handled.
      if (!state.heartsBroken) {
        const nonHearts = hand.filter((c) => !isHeart(c))
        if (nonHearts.length) return nonHearts
      }
      return [...hand]
    }
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
  const totalPts = taken.reduce((a, b) => a + b, 0)
  const moon = Boolean(
    state.config.shootTheMoon && totalPts > 0 && taken.some((t) => t === totalPts),
  )
  const deltas = new Map<string, number>()
  const parts: string[] = []

  if (moon) {
    const shooter = state.players.findIndex((p) => p.takenThisHand === totalPts)
    for (let i = 0; i < state.players.length; i++) {
      const pl = state.players[i]!
      const delta = i === shooter ? 0 : totalPts
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

  const cardsLeft = state.players.reduce((s, p) => s + p.hand.length, 0)
  if (cardsLeft === 0) scoreHand(state)
}

export function applyTrickMove(state: TrickState, move: TrickMove): TrickApplyResult {
  if (state.config.variant === 'rooster') return applyRoosterMove(state, move)
  if (state.config.variant === 'spades') return applySpadesMove(state, move)
  if (state.config.variant === 'euchre') return applyEuchreMove(state, move)
  if (state.config.variant === 'ohhell') return applyOhHellMove(state, move)
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneTrick(state)
  const n = nPlayers(next)

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
      next.current = (next.current + 1) % n
      guard += 1
    } while (next.passed[next.current] && guard < n)

    if (next.passed.every(Boolean)) {
      for (let i = 0; i < n; i++) {
        const dest = passTargetIndex(i, next.passDirection, n)
        const gift = next.passQueue[i]
        if (!gift) continue
        next.players[dest]!.hand = sortTrickHand([...next.players[dest]!.hand, ...gift])
      }
      next.passQueue = Array.from({ length: n }, () => null)
      next.phase = 'play'
      next.trickLeader = indexWithLeadCard(next)
      next.current = next.trickLeader
      next.log.push(`Pass complete — ${next.players[next.trickLeader]!.name} leads.`)
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

    if (next.trick.length >= n) {
      finishTrick(next)
    } else {
      next.current = (next.current + 1) % n
    }
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
