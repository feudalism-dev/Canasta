import { findCard, takeCards, type Card, type Suit, SUITS } from '../cards'
import {
  isRoosterBird,
  ROOSTER_COLOR,
  roosterColorLabel,
  roosterCounterPoints,
  roosterFaceLabel,
  roosterRankValue,
  ROOSTER_BID_STEP,
  ROOSTER_HAND_SIZE,
  ROOSTER_MAX_BID,
  ROOSTER_MIN_BID,
  ROOSTER_NEST_SIZE,
  sortRoosterHand,
} from './roosterDeck'
import { cloneTrick, currentPlayer } from './state'
import type { TrickHandScoreLine, TrickMove, TrickState } from './types'

export type TrickApplyResult = { ok: true; state: TrickState } | { ok: false; error: string }

export function teamOfIndex(i: number): 0 | 1 {
  return (i % 2 === 0 ? 0 : 1) as 0 | 1
}

export function partnerIndex(i: number): number {
  return (i + 2) % 4
}

function isTrumpCard(card: Card, trump: Suit | null): boolean {
  if (isRoosterBird(card)) return true
  return Boolean(trump && card.suit === trump)
}

export function legalRoosterPlays(state: TrickState, playerIndex: number): Card[] {
  const pl = state.players[playerIndex]
  if (!pl || state.phase !== 'play') return []
  const hand = pl.hand
  const trump = state.trump

  if (state.trick.length === 0) return [...hand]

  const led = state.trick[0]!.card
  const ledTrump = isTrumpCard(led, trump)

  if (ledTrump) {
    const trumps = hand.filter((c) => isTrumpCard(c, trump))
    if (trumps.length) return trumps
    return [...hand]
  }

  // Bird may always be played as trump; following plain suit: follow if able.
  const follow = hand.filter((c) => !isRoosterBird(c) && c.suit === led.suit)
  if (follow.length) return follow
  return [...hand]
}

function trickWinnerIndex(state: TrickState): number {
  const trump = state.trump
  const trick = state.trick
  let best = trick[0]!
  const ledTrump = isTrumpCard(best.card, trump)

  for (const play of trick.slice(1)) {
    const c = play.card
    const bestTrump = isTrumpCard(best.card, trump)
    const cTrump = isTrumpCard(c, trump)

    if (cTrump && !bestTrump) {
      best = play
      continue
    }
    if (!cTrump && bestTrump) continue
    if (cTrump && bestTrump) {
      if (roosterRankValue(c) > roosterRankValue(best.card)) best = play
      continue
    }
    // Neither trump: must follow led suit to win
    if (!ledTrump && c.suit === best.card.suit && roosterRankValue(c) > roosterRankValue(best.card)) {
      best = play
    }
  }

  const idx = state.players.findIndex((p) => p.seat === best.seat)
  return idx >= 0 ? idx : 0
}

function scoreRoosterHand(state: TrickState): void {
  const bidder = state.bidderIndex
  const bid = state.bidAmount
  if (bidder == null || bid <= 0) {
    state.phase = 'roundEnd'
    state.lastHandNote = 'No bid — hand void.'
    return
  }

  const bidTeam = teamOfIndex(bidder)
  const otherTeam = (1 - bidTeam) as 0 | 1
  const bidTaken = state.teamTaken[bidTeam]
  const otherTaken = state.teamTaken[otherTeam]

  const made = bidTaken >= bid
  let bidDelta = 0
  let otherDelta = otherTaken

  if (made) {
    bidDelta = bidTaken
  } else {
    bidDelta = -bid
  }

  const deltas = new Map<string, number>()
  for (let i = 0; i < 4; i++) {
    const pl = state.players[i]!
    const team = teamOfIndex(i)
    const delta = team === bidTeam ? bidDelta : otherDelta
    pl.score += delta
    deltas.set(pl.id, delta)
  }
  // Partners share one partnership total.
  for (const team of [0, 1] as const) {
    const shared = state.players[team]!.score
    state.players[team + 2]!.score = shared
  }

  const bidNames = `${state.players[bidder]!.name}/${state.players[partnerIndex(bidder)]!.name}`
  const note = made
    ? `${bidNames} made ${bid} with ${bidTaken} — +${bidTaken}. Opponents +${otherTaken}.`
    : `${bidNames} set on ${bid} (took ${bidTaken}) — ${bidDelta}. Opponents +${otherTaken}.`
  state.lastHandNote = note
  state.lastHandScores = state.players.map(
    (p): TrickHandScoreLine => ({
      playerId: p.id,
      name: p.name,
      delta: deltas.get(p.id) ?? 0,
      total: p.score,
    }),
  )
  state.log.push(note)
  state.phase = 'roundEnd'

  const target = state.config.playTo
  if (target != null) {
    const t0 = state.players[0]!.score
    const t1 = state.players[1]!.score
    if (t0 >= target || t1 >= target) {
      state.phase = 'matchEnd'
      if (t0 === t1) {
        // Tie at/over target — play another hand (stay roundEnd) per Hasbro.
        state.phase = 'roundEnd'
        state.log.push(`Both teams at ${t0} — play another hand to break the tie.`)
      } else {
        const winTeam = t0 > t1 ? 0 : 1
        state.winnerId = state.players[winTeam]!.id
        state.log.push(
          `Match over — Team ${winTeam === 0 ? '1+3' : '2+4'} wins with ${Math.max(t0, t1)}.`,
        )
      }
    }
  }
}

function finishRoosterTrick(state: TrickState): void {
  const winnerIdx = trickWinnerIndex(state)
  const winner = state.players[winnerIdx]!
  let pts = 0
  for (const play of state.trick) pts += roosterCounterPoints(play.card)

  const team = teamOfIndex(winnerIdx)
  state.teamTaken[team] += pts
  winner.takenThisHand += pts
  state.tricksTaken[winnerIdx] = (state.tricksTaken[winnerIdx] ?? 0) + 1

  const tricks = state.tricksTaken[winnerIdx] ?? 0
  const note =
    pts > 0
      ? `${winner.name} took the trick (+${pts}) · ${tricks} trick${tricks === 1 ? '' : 's'}`
      : `${winner.name} took the trick · ${tricks} trick${tricks === 1 ? '' : 's'}`
  state.lastTrickNote = note
  state.log.push(note)
  state.trick = []
  state.trickLeader = winnerIdx
  state.current = winnerIdx

  const cardsLeft = state.players.reduce((s, p) => s + p.hand.length, 0)
  if (cardsLeft === 0) {
    // Last trick winner takes the buried nest counters.
    let nestPts = 0
    for (const c of state.nest) nestPts += roosterCounterPoints(c)
    if (nestPts > 0) {
      state.teamTaken[team] += nestPts
      winner.takenThisHand += nestPts
      state.log.push(`${winner.name} took the nest (+${nestPts}).`)
    }
    scoreRoosterHand(state)
  }
}

function nextBidder(state: TrickState): number | null {
  const n = 4
  let i = (state.current + 1) % n
  for (let g = 0; g < n; g++) {
    if (!state.bidPassed[i]) return i
    i = (i + 1) % n
  }
  return null
}

function auctionOver(state: TrickState): boolean {
  const active = state.bidPassed.filter((p) => !p).length
  return active <= 1 && state.bidAmount > 0
}

function beginNest(state: TrickState): void {
  const bi = state.bidderIndex!
  const bidder = state.players[bi]!
  bidder.hand = sortRoosterHand([...bidder.hand, ...state.nest], null)
  state.nest = []
  state.phase = 'nest'
  state.current = bi
  state.log.push(`${bidder.name} takes the nest — bury ${ROOSTER_NEST_SIZE} cards.`)
}

export function applyRoosterMove(state: TrickState, move: TrickMove): TrickApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneTrick(state)

  if (move.t === 'bid' || move.t === 'passBid') {
    if (next.phase !== 'bid') return { ok: false, error: 'Not bidding' }
    const me = currentPlayer(next)
    if (next.bidPassed[next.current]) return { ok: false, error: 'Already passed' }

    if (move.t === 'passBid') {
      // Forced min bid: if everyone else passed and no bid yet, dealer cannot pass.
      const othersPassed = next.bidPassed.filter((p, i) => i !== next.current && p).length >= 3
      if (othersPassed && next.bidAmount === 0) {
        return { ok: false, error: `Dealer must bid at least ${ROOSTER_MIN_BID}` }
      }
      next.bidPassed[next.current] = true
      next.log.push(`${me.name} passes.`)

      if (auctionOver(next) && next.bidderIndex != null) {
        beginNest(next)
        return { ok: true, state: next }
      }
      // If three passed with no bid — should only happen before forced dealer; force handled above.
      const nxt = nextBidder(next)
      if (nxt == null) {
        // All passed somehow — force dealer 70
        next.bidderIndex = next.dealer
        next.bidAmount = ROOSTER_MIN_BID
        next.bidPassed = [true, true, true, true]
        next.bidPassed[next.dealer] = false
        beginNest(next)
        return { ok: true, state: next }
      }
      next.current = nxt
      return { ok: true, state: next }
    }

    const amount = move.amount
    if (amount < ROOSTER_MIN_BID || amount > ROOSTER_MAX_BID) {
      return { ok: false, error: `Bid ${ROOSTER_MIN_BID}–${ROOSTER_MAX_BID}` }
    }
    if (amount % ROOSTER_BID_STEP !== 0) {
      return { ok: false, error: `Bids rise by ${ROOSTER_BID_STEP}` }
    }
    if (amount <= next.bidAmount) {
      return { ok: false, error: `Must beat ${next.bidAmount}` }
    }
    next.bidAmount = amount
    next.bidderIndex = next.current
    next.log.push(`${me.name} bids ${amount}.`)

    const nxt = nextBidder(next)
    if (nxt == null || auctionOver(next)) {
      beginNest(next)
      return { ok: true, state: next }
    }
    next.current = nxt
    return { ok: true, state: next }
  }

  if (move.t === 'nestDiscard') {
    if (next.phase !== 'nest') return { ok: false, error: 'Not burying nest' }
    if (next.current !== next.bidderIndex) return { ok: false, error: 'Only the bidder buries' }
    if (move.cardIds.length !== ROOSTER_NEST_SIZE) {
      return { ok: false, error: `Bury exactly ${ROOSTER_NEST_SIZE} cards` }
    }
    const me = currentPlayer(next)
    const { taken, rest, missing } = takeCards(me.hand, move.cardIds)
    if (missing.length || taken.length !== ROOSTER_NEST_SIZE) {
      return { ok: false, error: 'Card not in hand' }
    }
    me.hand = sortRoosterHand(rest, null)
    next.nest = taken
    next.phase = 'trump'
    next.log.push(`${me.name} buried ${ROOSTER_NEST_SIZE} — name trump.`)
    return { ok: true, state: next }
  }

  if (move.t === 'nameTrump') {
    if (next.phase !== 'trump') return { ok: false, error: 'Not naming trump' }
    if (next.current !== next.bidderIndex) return { ok: false, error: 'Only the bidder names trump' }
    if (!SUITS.includes(move.suit as (typeof SUITS)[number])) {
      return { ok: false, error: 'Pick a color' }
    }
    next.trump = move.suit
    for (const pl of next.players) {
      pl.hand = sortRoosterHand(pl.hand, next.trump)
    }
    next.phase = 'play'
    next.trickLeader = next.bidderIndex!
    next.current = next.bidderIndex!
    next.log.push(
      `${currentPlayer(next).name} names ${ROOSTER_COLOR[move.suit as Exclude<Suit, 'J'>] ?? move.suit} trump — leads.`,
    )
    return { ok: true, state: next }
  }

  if (move.t === 'play') {
    if (next.phase !== 'play') return { ok: false, error: 'Not in play' }
    const me = currentPlayer(next)
    const legal = legalRoosterPlays(next, next.current)
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    if (!legal.some((c) => c.id === card.id)) return { ok: false, error: 'Illegal play' }

    const { rest, missing } = takeCards(me.hand, [move.cardId])
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    me.hand = rest
    next.trick.push({ seat: me.seat, card })
    if (next.trick.length === 1) next.lastTrickNote = null
    next.log.push(`${me.name} played ${roosterFaceLabel(card)} ${roosterColorLabel(card)}.`)

    if (next.trick.length >= 4) {
      finishRoosterTrick(next)
    } else {
      next.current = (next.current + 1) % 4
    }
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Not a Rooster move' }
}

export function suggestedBids(state: TrickState): number[] {
  const floor = Math.max(ROOSTER_MIN_BID, state.bidAmount + ROOSTER_BID_STEP)
  const out: number[] = []
  for (let a = floor; a <= ROOSTER_MAX_BID; a += ROOSTER_BID_STEP) out.push(a)
  return out
}

export { ROOSTER_HAND_SIZE, ROOSTER_MIN_BID, ROOSTER_NEST_SIZE }
