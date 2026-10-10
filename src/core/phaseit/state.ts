import { buildPhaseItDeck, shuffleDeck, sortPhaseItHand } from './deck'
import { phaseLabel } from './phases'
import { phaseItConfig, phaseItVariantLabel } from './variants'
import type { PhaseItPlayer, PhaseItState, PhaseItVariant } from './types'

export function clonePhaseIt(state: PhaseItState): PhaseItState {
  return structuredClone(state)
}

export function currentPlayer(state: PhaseItState): PhaseItPlayer {
  return state.players[state.current]!
}

export function topDiscard(state: PhaseItState) {
  return state.discard[state.discard.length - 1] ?? null
}

function ensureStock(state: PhaseItState): void {
  if (state.stock.length > 0) return
  if (state.discard.length <= 1) return
  const top = state.discard[state.discard.length - 1]!
  const rest = state.discard.slice(0, -1)
  state.discard = [top]
  state.stock = shuffleDeck(rest, Date.now() % 1e9)
  state.log.push('Stock reshuffled from discard.')
}

export function drawFromStock(state: PhaseItState, playerIndex: number): void {
  ensureStock(state)
  const c = state.stock[0]
  if (!c) return
  state.stock = state.stock.slice(1)
  const pl = state.players[playerIndex]!
  pl.hand = sortPhaseItHand([...pl.hand, c])
}

export function createPhaseItMatch(
  names: string[],
  computers: boolean[],
  variant: PhaseItVariant = 'classic',
  seed = Date.now(),
): PhaseItState {
  const config = phaseItConfig(variant, names.length)
  const n = config.playerCount
  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComp = computers.slice(0, n)
  while (useComp.length < n) useComp.push(true)

  const players: PhaseItPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: Boolean(useComp[i]),
    hand: [],
    phase: 0,
    laid: [],
    phaseDown: false,
    score: 0,
  }))

  const state: PhaseItState = {
    config,
    players,
    phase: 'play',
    current: 0,
    round: 1,
    stock: [],
    discard: [],
    hasDrawn: false,
    winnerId: null,
    log: [],
    lastHandNote: null,
    lastHandScores: null,
    lastMessage: null,
  }
  return dealPhaseItHand(state, seed)
}

export function dealPhaseItHand(state: PhaseItState, seed: number): PhaseItState {
  const next = clonePhaseIt(state)
  const n = next.players.length
  next.hasDrawn = false
  next.winnerId = null
  next.lastHandNote = null
  next.lastHandScores = null
  next.phase = 'play'

  for (const pl of next.players) {
    pl.hand = []
    pl.laid = []
    pl.phaseDown = false
  }

  let deck = shuffleDeck(buildPhaseItDeck(), seed)
  for (let c = 0; c < 10; c++) {
    for (let p = 0; p < n; p++) {
      const card = deck[0]
      if (!card) break
      deck = deck.slice(1)
      next.players[p]!.hand.push(card)
    }
  }
  for (const pl of next.players) pl.hand = sortPhaseItHand(pl.hand)

  // Starter discard — skip Skip as upcard if possible
  let starter = deck[0]
  deck = deck.slice(1)
  if (starter?.kind === 'skip' && deck.length) {
    deck.push(starter)
    starter = deck[0]
    deck = deck.slice(1)
  }
  next.stock = deck
  next.discard = starter ? [starter] : []
  next.current = (next.round - 1) % n

  const label = phaseItVariantLabel(next.config.variant)
  const cur = next.players[next.current]!
  next.log = [
    `Hand ${next.round} — ${label}. ${cur.name} leads · ${phaseLabel(cur.phase)}.`,
  ]
  next.lastMessage = next.log[0]!
  return next
}

export function dealNextPhaseItRound(state: PhaseItState): PhaseItState {
  if (state.phase !== 'roundEnd') return state
  const next = clonePhaseIt(state)
  next.round += 1
  return dealPhaseItHand(next, Date.now() % 1e9)
}

export function withPhysicalSeats(state: PhaseItState, seats: number[]): PhaseItState {
  const next = clonePhaseIt(state)
  for (let i = 0; i < next.players.length; i++) {
    next.players[i]!.seat = seats[i] ?? i
  }
  return next
}
