import { findCard, takeCards, type Card } from '../cards'
import { trickRankValue } from './deck'
import { cloneTrick, currentPlayer } from './state'
import { teamOfIndex } from './roosterRules'
import type { TrickHandScoreLine, TrickMove, TrickState } from './types'

export type TrickApplyResult = { ok: true; state: TrickState } | { ok: false; error: string }

function isSpade(c: Card): boolean {
  return c.suit === 'S'
}

export function legalSpadesPlays(state: TrickState, playerIndex: number): Card[] {
  const pl = state.players[playerIndex]
  if (!pl || state.phase !== 'play') return []
  const hand = pl.hand

  if (state.trick.length === 0) {
    if (!state.heartsBroken) {
      const non = hand.filter((c) => !isSpade(c))
      if (non.length) return non
    }
    return [...hand]
  }

  const led = state.trick[0]!.card.suit
  const follow = hand.filter((c) => c.suit === led)
  if (follow.length) return follow
  return [...hand]
}

function winnerOfTrick(state: TrickState): number {
  const trick = state.trick
  let best = trick[0]!
  for (const play of trick.slice(1)) {
    const c = play.card
    const bestTrump = isSpade(best.card)
    const cTrump = isSpade(c)
    if (cTrump && !bestTrump) {
      best = play
      continue
    }
    if (!cTrump && bestTrump) continue
    if (cTrump && bestTrump) {
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

function syncTeamScores(state: TrickState): void {
  for (const team of [0, 1] as const) {
    const shared = state.players[team]!.score
    state.players[team + 2]!.score = shared
  }
}

function scoreSpadesHand(state: TrickState): void {
  const tricks = state.tricksTaken
  const bids = state.playerBids.map((b) => b ?? 0)
  const deltas = new Map<string, number>()

  for (const team of [0, 1] as const) {
    const a = team
    const b = team + 2
    const nilA = bids[a] === 0
    const nilB = bids[b] === 0
    const bidA = nilA ? 0 : bids[a]!
    const bidB = nilB ? 0 : bids[b]!
    const teamBid = bidA + bidB

    let takenA = tricks[a] ?? 0
    let takenB = tricks[b] ?? 0
    // Failed-nil tricks don't help partner contract
    let contractTaken = (nilA ? 0 : takenA) + (nilB ? 0 : takenB)
    const bagsFromNilFail = (nilA && takenA > 0 ? takenA : 0) + (nilB && takenB > 0 ? takenB : 0)

    let delta = 0
    if (teamBid > 0) {
      if (contractTaken >= teamBid) {
        const over = contractTaken - teamBid + bagsFromNilFail
        delta += teamBid * 10 + over
        state.bags[team] += over
      } else {
        delta -= teamBid * 10
        // bags from failed nil still accumulate
        state.bags[team] += bagsFromNilFail
      }
    } else {
      // both nil or only bags from fails
      state.bags[team] += bagsFromNilFail
    }

    if (nilA) delta += takenA === 0 ? 100 : -100
    if (nilB) delta += takenB === 0 ? 100 : -100

    while (state.bags[team] >= 10) {
      delta -= 100
      state.bags[team] -= 10
    }

    state.players[a]!.score += delta
    state.players[b]!.score += delta
    deltas.set(state.players[a]!.id, delta)
    deltas.set(state.players[b]!.id, delta)
  }
  syncTeamScores(state)

  const parts = [0, 1].map((team) => {
    const names = `${state.players[team]!.name}/${state.players[team + 2]!.name}`
    const d = deltas.get(state.players[team]!.id) ?? 0
    return `${names} ${d >= 0 ? '+' : ''}${d}`
  })
  state.lastHandNote = `Hand scored — ${parts.join('; ')}`
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
  if (target != null) {
    const t0 = state.players[0]!.score
    const t1 = state.players[1]!.score
    if (t0 >= target || t1 >= target) {
      if (t0 === t1) {
        state.log.push(`Tied at ${t0} — play another hand.`)
      } else {
        state.phase = 'matchEnd'
        const win = t0 > t1 ? 0 : 1
        state.winnerId = state.players[win]!.id
        state.log.push(`Match over — Team ${win === 0 ? '1+3' : '2+4'} wins with ${Math.max(t0, t1)}.`)
      }
    }
  }
}

function finishTrick(state: TrickState): void {
  const winnerIdx = winnerOfTrick(state)
  const winner = state.players[winnerIdx]!
  for (const play of state.trick) {
    if (isSpade(play.card)) state.heartsBroken = true
  }
  winner.takenThisHand += 1
  state.tricksTaken[winnerIdx] = (state.tricksTaken[winnerIdx] ?? 0) + 1
  const tricks = state.tricksTaken[winnerIdx] ?? 0
  state.lastTrickNote = `${winner.name} took the trick · ${tricks} this hand`
  state.log.push(state.lastTrickNote)
  state.trick = []
  state.trickLeader = winnerIdx
  state.current = winnerIdx

  if (state.players.every((p) => p.hand.length === 0)) scoreSpadesHand(state)
}

export function applySpadesMove(state: TrickState, move: TrickMove): TrickApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneTrick(state)

  if (move.t === 'bid') {
    if (next.phase !== 'bid') return { ok: false, error: 'Not bidding' }
    const amount = move.amount
    if (!Number.isInteger(amount) || amount < 0 || amount > 13) {
      return { ok: false, error: 'Bid 0–13 (0 = Nil)' }
    }
    if (next.playerBids[next.current] != null) return { ok: false, error: 'Already bid' }
    next.playerBids[next.current] = amount
    const me = currentPlayer(next)
    next.log.push(`${me.name} bids ${amount === 0 ? 'Nil' : amount}.`)

    const nxt = (next.current + 1) % 4
    if (next.playerBids.every((b) => b != null)) {
      next.phase = 'play'
      next.trickLeader = (next.dealer + 1) % 4
      next.current = next.trickLeader
      const t0 = (next.playerBids[0] ?? 0) + (next.playerBids[2] ?? 0)
      const t1 = (next.playerBids[1] ?? 0) + (next.playerBids[3] ?? 0)
      next.log.push(`Contracts — 1+3: ${t0}, 2+4: ${t1}. ${next.players[next.current]!.name} leads.`)
    } else {
      next.current = nxt
    }
    return { ok: true, state: next }
  }

  if (move.t === 'play') {
    if (next.phase !== 'play') return { ok: false, error: 'Not in play' }
    const me = currentPlayer(next)
    const legal = legalSpadesPlays(next, next.current)
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    if (!legal.some((c) => c.id === card.id)) return { ok: false, error: 'Illegal play' }
    const { rest, missing } = takeCards(me.hand, [move.cardId])
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    me.hand = rest
    next.trick.push({ seat: me.seat, card })
    if (isSpade(card)) next.heartsBroken = true
    if (next.trick.length === 1) next.lastTrickNote = null
    next.log.push(`${me.name} played ${card.rank}${card.suit}.`)
    if (next.trick.length >= 4) finishTrick(next)
    else next.current = (next.current + 1) % 4
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Not a Spades move' }
}

export function suggestSpadesBid(state: TrickState): number {
  const me = currentPlayer(state)
  let spades = 0
  let high = 0
  for (const c of me.hand) {
    if (isSpade(c)) spades += 1
    if (trickRankValue(c.rank) >= 12) high += 1
  }
  if (spades <= 1 && high <= 1) return 0 // nil try
  return Math.max(1, Math.min(6, Math.round(spades * 0.7 + high * 0.4)))
}

export { teamOfIndex }
