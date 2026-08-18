import { buildDeck, isRedThree, isWild, sortHand, type Card } from './cards'
import { mulberry32, shuffleInPlace } from './rng'
import type { HouseRules, MatchState, PlayerState, TeamState, Variant } from './types'
import { teamOfSeat, variantConfig } from './variants'

export type CreateMatchOpts = {
  variant: Variant
  names: string[]
  humans: boolean[]
  seed?: number
  house?: HouseRules
  stock?: Card[]
}

export function emptyTeam(): TeamState {
  return { melds: [], redThrees: [], score: 0, hasInitialMeld: false }
}

export function cloneState(state: MatchState): MatchState {
  return structuredClone(state)
}

export function createMatch(opts: CreateMatchOpts): MatchState {
  const n = opts.names.length <= 2 ? 2 : 4
  const humans = opts.humans.slice(0, n)
  while (humans.length < n) humans.push(false)
  const padded = opts.names.slice(0, n)
  while (padded.length < n) padded.push(`Computer ${padded.length + 1}`)
  const config = variantConfig(opts.variant, n, opts.house)
  const seed = opts.seed ?? Date.now()
  const players: PlayerState[] = padded.map((displayName, seat) => ({
    displayName,
    isHuman: humans[seat] ?? false,
    team: teamOfSeat(seat),
    seat,
    hand: [],
    foot: [],
    footPickedUp: config.footSize === 0,
    meldedThisHand: false,
    concealedEligible: true,
  }))
  const state: MatchState = {
    config,
    phase: 'awaitingDraw',
    players,
    teams: [emptyTeam(), emptyTeam()],
    stock: [],
    discard: [],
    discardFrozen: false,
    currentPlayer: 0,
    dealer: 0,
    round: 1,
    lastMessage: '',
    winnerTeam: -1,
    pendingGoOut: null,
    seed,
    turnNumber: 1,
    wentOutPlayer: -1,
  }
  dealHand(state, opts.stock)
  return state
}

export function resetHandKeepScores(state: MatchState): void {
  for (const p of state.players) {
    p.hand = []
    p.foot = []
    p.footPickedUp = state.config.footSize === 0
    p.meldedThisHand = false
    p.concealedEligible = true
  }
  for (const t of state.teams) {
    t.melds = []
    t.redThrees = []
    t.hasInitialMeld = false
  }
  state.discard = []
  state.discardFrozen = false
  state.pendingGoOut = null
  state.wentOutPlayer = -1
  state.dealer = (state.dealer + 1) % state.players.length
  state.currentPlayer = (state.dealer + 1) % state.players.length
  dealHand(state)
}

export function dealHand(state: MatchState, forcedStock?: Card[]): void {
  const rand = mulberry32(state.seed + state.round * 997 + state.dealer * 13)
  const deck = forcedStock ? [...forcedStock] : shuffleInPlace(buildDeck(state.config.deckCount), rand)
  const { handSize, footSize } = state.config
  for (const p of state.players) {
    p.hand = sortHand(deck.splice(0, handSize))
    if (footSize > 0) p.foot = deck.splice(0, footSize)
  }
  state.stock = deck
  startDiscard(state)
  for (let i = 0; i < state.players.length; i++) {
    flushRedThrees(state, i, state.config.redThreeReplacement)
    if (state.config.footSize > 0) flushRedThreesFromFoot(state, i)
  }
  const variantName = state.config.variant === 'canasta' ? 'Canasta' : 'Hand and Foot'
  state.phase = 'awaitingDraw'
  state.lastMessage = `${variantName} — ${state.players[state.currentPlayer]!.displayName} draws.`
}

function startDiscard(state: MatchState): void {
  state.discard = []
  state.discardFrozen = false
  while (state.stock.length > 0) {
    const card = state.stock.shift()!
    state.discard.push(card)
    if (isWild(card) || isRedThree(card)) {
      state.discardFrozen = true
      continue
    }
    break
  }
}

function extractReds(cards: Card[]): { kept: Card[]; reds: Card[] } {
  const kept: Card[] = []
  const reds: Card[] = []
  for (const c of cards) {
    if (isRedThree(c)) reds.push(c)
    else kept.push(c)
  }
  return { kept, reds }
}

export function flushRedThrees(state: MatchState, playerIndex: number, replace: boolean): number {
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  let laid = 0
  let guard = 0
  while (guard < 40) {
    guard++
    const { kept, reds } = extractReds(player.hand)
    if (reds.length === 0) {
      player.hand = sortHand(kept)
      break
    }
    team.redThrees.push(...reds)
    laid += reds.length
    player.hand = kept
    if (!replace) break
    for (let i = 0; i < reds.length; i++) {
      if (state.stock.length === 0) {
        player.hand = sortHand(player.hand)
        return laid
      }
      player.hand.push(state.stock.shift()!)
    }
  }
  player.hand = sortHand(player.hand)
  return laid
}

export function flushRedThreesFromFoot(state: MatchState, playerIndex: number): number {
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const { kept, reds } = extractReds(player.foot)
  if (reds.length === 0) return 0
  team.redThrees.push(...reds)
  player.foot = kept
  return reds.length
}

export function maybePickupFoot(state: MatchState, playerIndex: number, viaDiscard: boolean): boolean {
  const player = state.players[playerIndex]!
  if (state.config.footSize === 0) return false
  if (player.footPickedUp) return false
  if (player.hand.length > 0) return false
  if (player.foot.length === 0) return false
  player.hand = sortHand(player.foot)
  player.foot = []
  player.footPickedUp = true
  flushRedThrees(state, playerIndex, false)
  state.lastMessage = `${player.displayName} picks up the Foot.`
  return viaDiscard
}
