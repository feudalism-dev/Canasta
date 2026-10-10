import { findCard, takeCards, type Card, type Suit } from '../cards'
import { trickRankValue } from './deck'
import { cloneTrick, currentPlayer } from './state'
import type { TrickHandScoreLine, TrickMove, TrickState } from './types'

export type TrickApplyResult = { ok: true; state: TrickState } | { ok: false; error: string }

function isTrump(card: Card, trump: Suit | null): boolean {
  return Boolean(trump && card.suit === trump)
}

export function legalOhHellPlays(state: TrickState, playerIndex: number): Card[] {
  const pl = state.players[playerIndex]
  if (!pl || state.phase !== 'play') return []
  const hand = pl.hand
  if (state.trick.length === 0) return [...hand]
  const led = state.trick[0]!.card.suit
  const follow = hand.filter((c) => c.suit === led)
  if (follow.length) return follow
  return [...hand]
}

function winnerOfTrick(state: TrickState): number {
  const trump = state.trump
  let best = state.trick[0]!
  for (const play of state.trick.slice(1)) {
    const c = play.card
    const bestT = isTrump(best.card, trump)
    const cT = isTrump(c, trump)
    if (cT && !bestT) {
      best = play
      continue
    }
    if (!cT && bestT) continue
    if (cT && bestT) {
      if (trickRankValue(c.rank) > trickRankValue(best.card.rank)) best = play
      continue
    }
    if (c.suit === best.card.suit && trickRankValue(c.rank) > trickRankValue(best.card.rank)) {
      best = play
    }
  }
  const idx = state.players.findIndex((p) => p.seat === best.seat)
  return idx >= 0 ? idx : 0
}

function scoreOhHellHand(state: TrickState): void {
  const n = state.players.length
  const deltas = new Map<string, number>()
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const pl = state.players[i]!
    const bid = state.playerBids[i] ?? -1
    const took = state.tricksTaken[i] ?? 0
    const delta = bid === took ? 10 + took : 0
    pl.score += delta
    deltas.set(pl.id, delta)
    parts.push(`${pl.name} bid ${bid}/took ${took} → ${delta >= 0 ? '+' : ''}${delta}`)
  }
  state.lastHandNote = parts.join('; ')
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
    const sorted = [...state.players].sort((a, b) => b.score - a.score)
    if (sorted[0]!.score === sorted[1]!.score && sorted[0]!.score >= target) {
      state.log.push(`Tied at ${sorted[0]!.score} — play another hand.`)
    } else {
      state.phase = 'matchEnd'
      state.winnerId = sorted[0]!.id
      state.log.push(`Match over — ${sorted[0]!.name} wins with ${sorted[0]!.score}.`)
    }
  }
}

function finishTrick(state: TrickState): void {
  const winnerIdx = winnerOfTrick(state)
  const winner = state.players[winnerIdx]!
  winner.takenThisHand += 1
  state.tricksTaken[winnerIdx] = (state.tricksTaken[winnerIdx] ?? 0) + 1
  state.lastTrickNote = `${winner.name} took the trick`
  state.log.push(state.lastTrickNote)
  state.trick = []
  state.trickLeader = winnerIdx
  state.current = winnerIdx
  if (state.players.every((p) => p.hand.length === 0)) scoreOhHellHand(state)
}

export function ohHellBidSum(state: TrickState): number {
  return state.playerBids.reduce<number>((s, b) => s + (b ?? 0), 0)
}

export function legalOhHellBids(state: TrickState): number[] {
  const hs = state.handSize
  const out: number[] = []
  for (let b = 0; b <= hs; b++) out.push(b)
  const isDealer = state.current === state.dealer
  if (!isDealer) return out
  const others = ohHellBidSum(state) // dealer not yet included
  return out.filter((b) => others + b !== hs)
}

export function applyOhHellMove(state: TrickState, move: TrickMove): TrickApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneTrick(state)
  const n = next.players.length

  if (move.t === 'bid') {
    if (next.phase !== 'bid') return { ok: false, error: 'Not bidding' }
    const legal = legalOhHellBids(next)
    if (!legal.includes(move.amount)) {
      return {
        ok: false,
        error:
          next.current === next.dealer
            ? `Dealer cannot make total bids equal ${next.handSize}`
            : `Bid 0–${next.handSize}`,
      }
    }
    next.playerBids[next.current] = move.amount
    next.log.push(`${currentPlayer(next).name} bids ${move.amount}.`)
    const nxt = (next.current + 1) % n
    if (next.playerBids.every((b) => b != null)) {
      next.phase = 'play'
      next.trickLeader = (next.dealer + 1) % n
      next.current = next.trickLeader
      next.log.push(
        `Trump ${next.trump}. ${next.players[next.current]!.name} leads.`,
      )
    } else {
      next.current = nxt
    }
    return { ok: true, state: next }
  }

  if (move.t === 'play') {
    if (next.phase !== 'play') return { ok: false, error: 'Not in play' }
    const me = currentPlayer(next)
    const legal = legalOhHellPlays(next, next.current)
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    if (!legal.some((c) => c.id === card.id)) return { ok: false, error: 'Illegal play' }
    const { rest, missing } = takeCards(me.hand, [move.cardId])
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    me.hand = rest
    next.trick.push({ seat: me.seat, card })
    if (next.trick.length === 1) next.lastTrickNote = null
    next.log.push(`${me.name} played ${card.rank}${card.suit}.`)
    if (next.trick.length >= n) finishTrick(next)
    else next.current = (next.current + 1) % n
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Not an Oh Hell move' }
}

export function suggestOhHellBid(state: TrickState): number {
  const legal = legalOhHellBids(state)
  const me = currentPlayer(state)
  let guess = 0
  for (const c of me.hand) {
    if (state.trump && c.suit === state.trump) guess += 1
    else if (trickRankValue(c.rank) >= 13) guess += 0.5
  }
  const rounded = Math.max(0, Math.min(state.handSize, Math.round(guess)))
  if (legal.includes(rounded)) return rounded
  return legal[Math.floor(legal.length / 2)] ?? 0
}

