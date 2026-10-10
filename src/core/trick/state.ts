import { findCard, takeCards, type Card } from '../cards'
import { buildTrickDeck, shuffleSeeded, sortTrickHand, trickRankValue } from './deck'
import { clampTrickPlayerCount, heartsHandSize, nextPassDirection, trickConfig } from './variants'
import type { PassDirection, TrickPlayer, TrickState, TrickVariant } from './types'

export function createTrickMatch(
  names: string[],
  computers: boolean[],
  variant: TrickVariant = 'hearts',
  seed = Date.now(),
): TrickState {
  if (variant !== 'hearts') {
    throw new Error(`${variant} is not playable yet — choose Hearts`)
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
      phase: 'pass',
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
    },
    seed,
  )
}

function prepareDeck(playerCount: number, seed: number): Card[] {
  let deck = buildTrickDeck()
  if (playerCount === 3) {
    // 51 cards → 17 each (drop 2♦).
    deck = deck.filter((c) => !(c.suit === 'D' && c.rank === '2'))
  }
  return shuffleSeeded(deck, seed)
}

function dealHand(state: TrickState, seed: number): TrickState {
  const n = state.players.length
  const handSize = heartsHandSize(n)
  const deck = prepareDeck(n, seed)
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
  const nextDir = nextPassDirection(prev.passDirection, n) as PassDirection
  const base = cloneTrick(prev)
  base.round = prev.round + 1
  base.passDirection = nextDir
  base.phase = 'pass'
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
