import { findCard, takeCards, type Card } from '../cards'
import { buildTrickDeck, shuffleSeeded, sortTrickHand, trickRankValue } from './deck'
import {
  ROOSTER_HAND_SIZE,
  ROOSTER_NEST_SIZE,
  shuffleRoosterDeck,
  sortRoosterHand,
} from './roosterDeck'
import { clampTrickPlayerCount, heartsHandSize, nextPassDirection, trickConfig } from './variants'
import type { PassDirection, TrickPlayer, TrickState, TrickVariant } from './types'

function emptyRoosterFields(dealer = 0): Pick<
  TrickState,
  'dealer' | 'bidAmount' | 'bidderIndex' | 'bidPassed' | 'nest' | 'trump' | 'teamTaken'
> {
  return {
    dealer,
    bidAmount: 0,
    bidderIndex: null,
    bidPassed: [false, false, false, false],
    nest: [],
    trump: null,
    teamTaken: [0, 0],
  }
}

export function createTrickMatch(
  names: string[],
  computers: boolean[],
  variant: TrickVariant = 'hearts',
  seed = Date.now(),
): TrickState {
  if (variant !== 'hearts' && variant !== 'rooster') {
    throw new Error(`${variant} is not playable yet — choose Hearts or Rooster`)
  }
  const n = clampTrickPlayerCount(variant, names.length)
  const config = trickConfig(variant, n)
  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComputers = computers.slice(0, n)
  while (useComputers.length < n) useComputers.push(true)

  const players: TrickPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: !!useComputers[i],
    hand: [],
    takenThisHand: 0,
    score: 0,
  }))

  const nils = () => Array.from({ length: n }, () => false)
  const nullPass = () => Array.from({ length: n }, () => null as Card[] | null)

  return dealHand(
    {
      config,
      players,
      phase: variant === 'rooster' ? 'bid' : 'pass',
      current: 0,
      round: 1,
      passDirection: 'left',
      passed: nils(),
      passQueue: nullPass(),
      heartsBroken: false,
      trick: [],
      trickLeader: 0,
      tricksTaken: Array.from({ length: n }, () => 0),
      winnerId: null,
      log: [],
      lastHandNote: null,
      lastHandScores: null,
      lastTrickNote: null,
      ...emptyRoosterFields(0),
    },
    seed,
  )
}

function prepareHeartsDeck(playerCount: number, seed: number): Card[] {
  let deck = buildTrickDeck()
  if (playerCount === 3) {
    deck = deck.filter((c) => !(c.suit === 'D' && c.rank === '2'))
  }
  return shuffleSeeded(deck, seed)
}

function dealHeartsHand(state: TrickState, seed: number): TrickState {
  const n = state.players.length
  const handSize = heartsHandSize(n)
  const deck = prepareHeartsDeck(n, seed)
  const next = cloneTrick(state)
  for (const pl of next.players) {
    pl.hand = []
    pl.takenThisHand = 0
  }
  next.tricksTaken = Array.from({ length: n }, () => 0)
  next.heartsBroken = false
  next.trick = []
  next.passed = Array.from({ length: n }, () => false)
  next.passQueue = Array.from({ length: n }, () => null)
  next.lastHandNote = null
  next.lastHandScores = null
  next.lastTrickNote = null
  next.winnerId = null
  Object.assign(next, emptyRoosterFields(next.dealer))

  let stock = deck
  for (let c = 0; c < handSize; c++) {
    for (let p = 0; p < n; p++) {
      const card = stock[0]
      if (!card) break
      stock = stock.slice(1)
      next.players[p]!.hand.push(card)
    }
  }
  for (const pl of next.players) pl.hand = sortTrickHand(pl.hand)

  if (next.passDirection === 'hold') {
    next.phase = 'play'
    next.trickLeader = indexWithLeadCard(next)
    next.current = next.trickLeader
    next.log = [`Hand ${next.round} — hold (no pass). ${n} players · lead.`]
  } else {
    next.phase = 'pass'
    next.current = 0
    next.log = [`Hand ${next.round} — pass three ${next.passDirection} (${n} players).`]
  }
  return next
}

function dealRoosterHand(state: TrickState, seed: number): TrickState {
  const next = cloneTrick(state)
  for (const pl of next.players) {
    pl.hand = []
    pl.takenThisHand = 0
  }
  next.tricksTaken = [0, 0, 0, 0]
  next.trick = []
  next.heartsBroken = false
  next.passed = [false, false, false, false]
  next.passQueue = [null, null, null, null]
  next.lastHandNote = null
  next.lastHandScores = null
  next.lastTrickNote = null
  next.winnerId = null

  const dealer = next.dealer
  Object.assign(next, emptyRoosterFields(dealer))

  let stock = shuffleRoosterDeck(seed)
  for (let c = 0; c < ROOSTER_HAND_SIZE; c++) {
    for (let p = 0; p < 4; p++) {
      const card = stock[0]
      if (!card) break
      stock = stock.slice(1)
      next.players[p]!.hand.push(card)
    }
  }
  next.nest = stock.slice(0, ROOSTER_NEST_SIZE)
  for (const pl of next.players) pl.hand = sortRoosterHand(pl.hand, null)

  next.phase = 'bid'
  next.current = (dealer + 1) % 4
  next.trickLeader = next.current
  next.log = [
    `Hand ${next.round} — Rooster deal. Nest ${ROOSTER_NEST_SIZE}. Bidding starts left of dealer (${next.players[dealer]!.name}).`,
  ]
  return next
}

function dealHand(state: TrickState, seed: number): TrickState {
  if (state.config.variant === 'rooster') return dealRoosterHand(state, seed)
  return dealHeartsHand(state, seed)
}

/** Prefer 2♣; else lowest club in play; else seat 0. */
export function indexWithLeadCard(state: TrickState): number {
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i]!.hand.some((c) => c.suit === 'C' && c.rank === '2')) return i
  }
  let bestIdx = 0
  let bestVal = 99
  let found = false
  for (let i = 0; i < state.players.length; i++) {
    for (const c of state.players[i]!.hand) {
      if (c.suit !== 'C') continue
      const v = trickRankValue(c.rank)
      if (!found || v < bestVal) {
        found = true
        bestVal = v
        bestIdx = i
      }
    }
  }
  return found ? bestIdx : 0
}

/** @deprecated use indexWithLeadCard */
export function indexWithTwoOfClubs(state: TrickState): number {
  return indexWithLeadCard(state)
}

export function cloneTrick(state: TrickState): TrickState {
  return structuredClone(state)
}

export function currentPlayer(state: TrickState): TrickPlayer {
  return state.players[state.current]!
}

export function removeFromHand(player: TrickPlayer, ids: string[]): string | null {
  const { taken, rest, missing } = takeCards(player.hand, ids)
  if (missing.length || taken.length !== ids.length) return 'Card not in hand'
  player.hand = sortTrickHand(rest)
  return null
}

export function findInHand(player: TrickPlayer, id: string) {
  return findCard(player.hand, id)
}

export function dealNextTrickRound(prev: TrickState, seed = Date.now()): TrickState {
  const n = prev.players.length
  const base = cloneTrick(prev)
  base.round = prev.round + 1
  if (prev.config.variant === 'rooster') {
    base.dealer = (prev.dealer + 1) % 4
    base.phase = 'bid'
  } else {
    base.passDirection = nextPassDirection(prev.passDirection, n) as PassDirection
    base.phase = 'pass'
  }
  for (const pl of base.players) {
    pl.hand = []
    pl.takenThisHand = 0
  }
  return dealHand(base, seed)
}

export function withPhysicalSeats(state: TrickState, seats: number[]): TrickState {
  const next = cloneTrick(state)
  next.players = next.players.map((p, i) => ({
    ...p,
    seat: seats[i] ?? p.seat,
  }))
  return next
}
