import { findCard, takeCards, type Card, type Suit, SUITS } from '../cards'
import { trickRankValue } from './deck'
import { cloneTrick, currentPlayer } from './state'
import { teamOfIndex } from './roosterRules'
import type { TrickHandScoreLine, TrickMove, TrickState } from './types'

export type TrickApplyResult = { ok: true; state: TrickState } | { ok: false; error: string }

export function sameColor(a: Suit, b: Suit): boolean {
  const red = a === 'H' || a === 'D'
  const redB = b === 'H' || b === 'D'
  return red === redB
}

export function leftBowerSuit(trump: Suit): Suit {
  if (trump === 'H') return 'D'
  if (trump === 'D') return 'H'
  if (trump === 'S') return 'C'
  return 'S'
}

export function isRightBower(card: Card, trump: Suit): boolean {
  return card.rank === 'J' && card.suit === trump
}

export function isLeftBower(card: Card, trump: Suit): boolean {
  return card.rank === 'J' && card.suit === leftBowerSuit(trump)
}

export function isTrumpCard(card: Card, trump: Suit | null): boolean {
  if (!trump) return false
  return card.suit === trump || isLeftBower(card, trump)
}

/** Higher = stronger. Right bower 100, left 90, then A–9 trump, then off-suit. */
export function euchrePower(card: Card, trump: Suit | null, led: Suit | null): number {
  if (!trump) return trickRankValue(card.rank)
  if (isRightBower(card, trump)) return 100
  if (isLeftBower(card, trump)) return 90
  if (card.suit === trump) return 70 + trickRankValue(card.rank)
  if (led && card.suit === led) return trickRankValue(card.rank)
  return 0
}

export function effectiveSuit(card: Card, trump: Suit | null): Suit {
  if (trump && isLeftBower(card, trump)) return trump
  return card.suit
}

export function legalEuchrePlays(state: TrickState, playerIndex: number): Card[] {
  const pl = state.players[playerIndex]
  if (!pl || state.phase !== 'play') return []
  const hand = pl.hand
  const trump = state.trump
  if (state.trick.length === 0) return [...hand]
  const led = effectiveSuit(state.trick[0]!.card, trump)
  const follow = hand.filter((c) => effectiveSuit(c, trump) === led)
  if (follow.length) return follow
  return [...hand]
}

function winnerOfTrick(state: TrickState): number {
  const trump = state.trump
  const led = effectiveSuit(state.trick[0]!.card, trump)
  let best = state.trick[0]!
  let bestPow = euchrePower(best.card, trump, led)
  for (const play of state.trick.slice(1)) {
    const pow = euchrePower(play.card, trump, led)
    if (pow > bestPow) {
      best = play
      bestPow = pow
    }
  }
  const idx = state.players.findIndex((p) => p.seat === best.seat)
  return idx >= 0 ? idx : 0
}

function syncTeamScores(state: TrickState): void {
  for (const team of [0, 1] as const) {
    state.players[team + 2]!.score = state.players[team]!.score
  }
}

function scoreEuchreHand(state: TrickState): void {
  const maker = state.bidderIndex
  if (maker == null) {
    state.phase = 'roundEnd'
    return
  }
  const makers = teamOfIndex(maker)
  const makerTricks =
    (state.tricksTaken[makers] ?? 0) + (state.tricksTaken[makers + 2] ?? 0)
  // When alone, partner sits out — only maker's tricks count (already only maker plays)
  let makerPts = 0
  let defPts = 0
  if (makerTricks >= 3) {
    if (state.alone) {
      makerPts = makerTricks === 5 ? 4 : 1
    } else {
      makerPts = makerTricks === 5 ? 2 : 1
    }
  } else {
    defPts = 2
  }

  const deltas = new Map<string, number>()
  for (let i = 0; i < 4; i++) {
    const team = teamOfIndex(i)
    const delta = team === makers ? makerPts : defPts
    state.players[i]!.score += delta
    deltas.set(state.players[i]!.id, delta)
  }
  syncTeamScores(state)

  const note =
    makerPts > 0
      ? `Makers score ${makerPts} (${makerTricks} tricks${state.alone ? ', alone' : ''}).`
      : `Euchred! Defenders score 2 (${makerTricks} tricks).`
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

  const target = state.config.playTo ?? 10
  const t0 = state.players[0]!.score
  const t1 = state.players[1]!.score
  if (t0 >= target || t1 >= target) {
    if (t0 === t1) state.log.push(`Tied at ${t0} — play another hand.`)
    else {
      state.phase = 'matchEnd'
      const win = t0 > t1 ? 0 : 1
      state.winnerId = state.players[win]!.id
      state.log.push(`Match over — Team ${win === 0 ? '1+3' : '2+4'} wins with ${Math.max(t0, t1)}.`)
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
  state.current = nextActive(state, winnerIdx)

  const cardsLeft = state.players.reduce((s, p) => s + p.hand.length, 0)
  if (cardsLeft === 0) scoreEuchreHand(state)
}

/** Skip sitting-out partner when alone. */
export function nextActive(state: TrickState, from: number): number {
  let i = (from + 1) % 4
  for (let g = 0; g < 4; g++) {
    if (state.alone && state.bidderIndex != null) {
      const partner = (state.bidderIndex + 2) % 4
      if (i === partner) {
        i = (i + 1) % 4
        continue
      }
    }
    return i
  }
  return i
}

function beginPlay(state: TrickState): void {
  state.phase = 'play'
  // Left of dealer leads (or left of maker if alone — still left of dealer)
  state.trickLeader = (state.dealer + 1) % 4
  if (state.alone && state.bidderIndex != null && state.trickLeader === (state.bidderIndex + 2) % 4) {
    state.trickLeader = nextActive(state, state.dealer)
  }
  state.current = state.trickLeader
  const t = state.trump!
  state.log.push(
    `${state.players[state.bidderIndex!]!.name} makes ${t}${state.alone ? ' alone' : ''} — ${state.players[state.current]!.name} leads.`,
  )
}

export function applyEuchreMove(state: TrickState, move: TrickMove): TrickApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneTrick(state)
  const up = next.nest[0] // turned card

  if (move.t === 'passBid') {
    if (next.phase !== 'bid') return { ok: false, error: 'Not bidding' }
    next.bidPassed[next.current] = true
    next.log.push(`${currentPlayer(next).name} passes.`)
    const nxt = (next.current + 1) % 4
    if (next.bidPassed.every(Boolean)) {
      if (next.euchreRound === 1) {
        next.euchreRound = 2
        next.bidPassed = [false, false, false, false]
        next.current = (next.dealer + 1) % 4
        next.log.push('Second round — name a trump (not the turned suit).')
      } else {
        // Redeal
        next.log.push('All pass — redeal.')
        next.phase = 'roundEnd'
        next.lastHandNote = 'All passed — deal again.'
      }
    } else {
      next.current = nxt
    }
    return { ok: true, state: next }
  }

  if (move.t === 'bid') {
    // amount: 1 = order up / make, 2 = make alone
    if (next.phase !== 'bid') return { ok: false, error: 'Not bidding' }
    const alone = move.amount === 2
    if (next.euchreRound === 1) {
      if (!up) return { ok: false, error: 'No turned card' }
      next.trump = up.suit
      next.bidderIndex = next.current
      next.alone = alone
      // Dealer takes up card and will discard in nest phase
      const dealer = next.players[next.dealer]!
      dealer.hand = [...dealer.hand, up]
      next.nest = next.nest.slice(1)
      next.phase = 'nest'
      next.current = next.dealer
      next.log.push(
        `${currentPlayer(next).name} orders up ${up.suit}${alone ? ' alone' : ''}. Dealer discards.`,
      )
      // Fix log - current was bidder not dealer
      next.log[next.log.length - 1] =
        `${next.players[next.bidderIndex]!.name} orders up ${up.suit}${alone ? ' alone' : ''}. Dealer discards.`
      return { ok: true, state: next }
    }
    return { ok: false, error: 'Name a trump suit' }
  }

  if (move.t === 'nameTrump') {
    if (next.phase !== 'bid' || next.euchreRound !== 2) {
      return { ok: false, error: 'Not naming trump' }
    }
    if (!up) return { ok: false, error: 'No turned card' }
    if (move.suit === up.suit) return { ok: false, error: 'Must be a different suit' }
    if (!SUITS.includes(move.suit as (typeof SUITS)[number])) {
      return { ok: false, error: 'Pick a suit' }
    }
    next.trump = move.suit
    next.bidderIndex = next.current
    next.alone = false
    beginPlay(next)
    return { ok: true, state: next }
  }

  if (move.t === 'nestDiscard') {
    if (next.phase !== 'nest') return { ok: false, error: 'Not discarding' }
    if (next.current !== next.dealer) return { ok: false, error: 'Dealer discards' }
    if (move.cardIds.length !== 1) return { ok: false, error: 'Discard one card' }
    const me = currentPlayer(next)
    const { taken, rest, missing } = takeCards(me.hand, move.cardIds)
    if (missing.length || taken.length !== 1) return { ok: false, error: 'Card not in hand' }
    me.hand = rest
    next.nest = [...next.nest, ...taken]
    beginPlay(next)
    return { ok: true, state: next }
  }

  if (move.t === 'play') {
    if (next.phase !== 'play') return { ok: false, error: 'Not in play' }
    const me = currentPlayer(next)
    if (next.alone && next.bidderIndex != null && next.current === (next.bidderIndex + 2) % 4) {
      return { ok: false, error: 'Sitting out' }
    }
    const legal = legalEuchrePlays(next, next.current)
    const card = findCard(me.hand, move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    if (!legal.some((c) => c.id === card.id)) return { ok: false, error: 'Illegal play' }
    const { rest, missing } = takeCards(me.hand, [move.cardId])
    if (missing.length) return { ok: false, error: 'Card not in hand' }
    me.hand = rest
    next.trick.push({ seat: me.seat, card })
    if (next.trick.length === 1) next.lastTrickNote = null
    next.log.push(`${me.name} played ${card.rank}${card.suit}.`)
    const need = next.alone ? 3 : 4
    if (next.trick.length >= need) finishTrick(next)
    else next.current = nextActive(next, next.current)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Not an Euchre move' }
}

/** Bot: order up if strong trump; else pass / name best suit. */
export function suggestEuchreBid(state: TrickState): TrickMove {
  const me = currentPlayer(state)
  const up = state.nest[0]
  if (state.euchreRound === 1 && up) {
    const trumpish = me.hand.filter((c) => c.suit === up.suit || (c.rank === 'J' && sameColor(c.suit, up.suit))).length
    if (trumpish >= 3) return { t: 'bid', amount: 1 }
    return { t: 'passBid' }
  }
  // Round 2: name best suit
  let best: Suit = 'H'
  let bestN = -1
  for (const s of SUITS) {
    if (up && s === up.suit) continue
    const n = me.hand.filter((c) => c.suit === s || (c.rank === 'J' && sameColor(c.suit, s))).length
    if (n > bestN) {
      bestN = n
      best = s
    }
  }
  if (bestN >= 3) return { t: 'nameTrump', suit: best }
  return { t: 'passBid' }
}
