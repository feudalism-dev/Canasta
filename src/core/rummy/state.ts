import { findCard, takeCards } from '../cards'
import { buildRummyDeck, shuffleSeeded, sortRummyHand } from './deck'
import { rummyConfig } from './variants'
import type { RummyConfig, RummyPlayer, RummyState, RummyVariant } from './types'

export function createRummyMatch(
  names: string[],
  computers: boolean[],
  variant: RummyVariant = 'standard',
  seed = Date.now(),
): RummyState {
  const seatCap = variant === 'gin' ? 2 : Math.max(2, Math.min(4, names.length))
  const useNames = names.slice(0, seatCap)
  const useComputers = computers.slice(0, seatCap)
  const config = rummyConfig(variant, useNames.length)
  const deck = shuffleSeeded(buildRummyDeck(config.deckCount, config.jokers), seed)
  const players: RummyPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: !!useComputers[i],
    hand: [],
    melds: [],
    score: 0,
  }))
  let stock = deck
  for (let c = 0; c < config.handSize; c++) {
    for (let p = 0; p < players.length; p++) {
      const card = stock[0]
      if (!card) break
      stock = stock.slice(1)
      players[p]!.hand.push(card)
    }
  }
  const up = stock[0]
  stock = stock.slice(1)
  const discard = up ? [up] : []
  for (const pl of players) pl.hand = sortRummyHand(pl.hand)
  return {
    config,
    players,
    stock,
    discard,
    phase: 'draw',
    current: 0,
    round: 1,
    drew: false,
    winnerId: null,
    log: [`Dealt ${config.handSize} cards each (${config.variant}).`],
    lastHandNote: null,
    lastHandScores: null,
  }
}

export function cloneRummy(state: RummyState): RummyState {
  return structuredClone(state)
}

export function currentPlayer(state: RummyState): RummyPlayer {
  return state.players[state.current]!
}

export function removeFromHand(player: RummyPlayer, ids: string[]): string | null {
  const { taken, rest, missing } = takeCards(player.hand, ids)
  if (missing.length) return 'Card not in hand'
  if (taken.length !== ids.length) return 'Card not in hand'
  player.hand = sortRummyHand(rest)
  return null
}

export function findInHand(player: RummyPlayer, id: string) {
  return findCard(player.hand, id)
}

export function withConfig(state: RummyState, config: RummyConfig): RummyState {
  return { ...state, config }
}

/** Keep match scores; deal a fresh hand. */
export function dealNextRummyRound(prev: RummyState, seed = Date.now()): RummyState {
  const names = prev.players.map((p) => p.name)
  const computers = prev.players.map((p) => p.isComputer)
  const next = createRummyMatch(names, computers, prev.config.variant, seed)
  next.round = prev.round + 1
  next.players = next.players.map((p, i) => ({
    ...p,
    score: prev.players[i]?.score ?? 0,
    seat: prev.players[i]?.seat ?? p.seat,
    name: prev.players[i]?.name ?? p.name,
    isComputer: prev.players[i]?.isComputer ?? p.isComputer,
  }))
  next.log = [`Hand ${next.round} — scores carry over.`]
  next.lastHandNote = null
  next.lastHandScores = null
  return next
}

/** Assign physical table seats (0–3) after deal — used so Furware lines match chairs. */
export function withPhysicalSeats(state: RummyState, seats: number[]): RummyState {
  const next = cloneRummy(state)
  next.players = next.players.map((p, i) => ({
    ...p,
    seat: seats[i] ?? p.seat,
  }))
  return next
}
