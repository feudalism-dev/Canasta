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
  const playerCount = names.length
  const config = rummyConfig(variant, playerCount)
  const deck = shuffleSeeded(buildRummyDeck(config.deckCount, config.jokers), seed)
  const players: RummyPlayer[] = names.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: !!computers[i],
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
  }))
  next.log = [`Hand ${next.round} — scores carry over.`]
  return next
}
