import { findCard, takeCards } from '../cards'
import { buildTrickDeck, shuffleSeeded, sortTrickHand } from './deck'
import { nextPassDirection, trickConfig } from './variants'
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
  const config = trickConfig(variant, 4)
  const useNames = names.slice(0, 4)
  while (useNames.length < 4) useNames.push(`P${useNames.length + 1}`)
  const useComputers = computers.slice(0, 4)
  while (useComputers.length < 4) useComputers.push(true)

  const players: TrickPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: !!useComputers[i],
    hand: [],
    takenThisHand: 0,
    score: 0,
  }))

  return dealHand(
    {
      config,
      players,
      phase: 'pass',
      current: 0,
      round: 1,
      passDirection: 'left',
      passed: [false, false, false, false],
      passQueue: [null, null, null, null],
      heartsBroken: false,
      trick: [],
      trickLeader: 0,
      tricksTaken: [0, 0, 0, 0],
      winnerId: null,
      log: [],
      lastHandNote: null,
      lastHandScores: null,
    },
    seed,
  )
}

function dealHand(state: TrickState, seed: number): TrickState {
  const deck = shuffleSeeded(buildTrickDeck(), seed)
  const next = cloneTrick(state)
  for (const pl of next.players) {
    pl.hand = []
    pl.takenThisHand = 0
  }
  next.tricksTaken = [0, 0, 0, 0]
  next.heartsBroken = false
  next.trick = []
  next.passed = [false, false, false, false]
  next.passQueue = [null, null, null, null]
  next.lastHandNote = null
  next.lastHandScores = null
  next.winnerId = null

  let stock = deck
  for (let c = 0; c < 13; c++) {
    for (let p = 0; p < 4; p++) {
      const card = stock[0]
      if (!card) break
      stock = stock.slice(1)
      next.players[p]!.hand.push(card)
    }
  }
  for (const pl of next.players) pl.hand = sortTrickHand(pl.hand)

  if (next.passDirection === 'hold') {
    next.phase = 'play'
    next.trickLeader = indexWithTwoOfClubs(next)
    next.current = next.trickLeader
    next.log = [`Hand ${next.round} — hold (no pass). 2♣ leads.`]
  } else {
    next.phase = 'pass'
    next.current = 0
    next.log = [`Hand ${next.round} — pass three cards ${next.passDirection}.`]
  }
  return next
}

export function indexWithTwoOfClubs(state: TrickState): number {
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i]!.hand.some((c) => c.suit === 'C' && c.rank === '2')) return i
  }
  return 0
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
  const nextDir = nextPassDirection(prev.passDirection) as PassDirection
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
