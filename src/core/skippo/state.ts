import { buildSkippoDeck, shuffleDeck, sortSkippoHand } from './deck'
import { scoreStockOut } from './score'
import { clampSkippoPlayerCount, skippoConfig, skippoVariantLabel } from './variants'
import type { SkippoBuilder, SkippoCard, SkippoPlayer, SkippoState, SkippoVariant } from './types'

export function cloneSkippo(state: SkippoState): SkippoState {
  return structuredClone(state)
}

export function currentPlayer(state: SkippoState): SkippoPlayer {
  return state.players[state.current]!
}

export function emptyBuilders(): [SkippoBuilder, SkippoBuilder, SkippoBuilder, SkippoBuilder] {
  const one = (): SkippoBuilder => ({ cards: [], next: 1 })
  return [one(), one(), one(), one()]
}

export function emptyDiscards(): [SkippoCard[], SkippoCard[], SkippoCard[], SkippoCard[]] {
  return [[], [], [], []]
}

function ensureDraw(state: SkippoState): void {
  if (state.draw.length > 0) return
  if (state.recycle.length === 0) return
  state.draw = shuffleDeck(state.recycle, Date.now() % 1e9)
  state.recycle = []
  state.log.push('Draw pile reshuffled from completed builders.')
}

/** Draw up to `count` cards into hand (sorted). */
export function drawToHand(state: SkippoState, playerIndex: number, count: number): SkippoCard[] {
  const pl = state.players[playerIndex]!
  const taken: SkippoCard[] = []
  for (let i = 0; i < count; i++) {
    ensureDraw(state)
    const c = state.draw[0]
    if (!c) break
    state.draw = state.draw.slice(1)
    taken.push(c)
  }
  pl.hand = sortSkippoHand([...pl.hand, ...taken])
  return taken
}

/** Start-of-turn: fill hand to 5. */
export function refillHand(state: SkippoState, playerIndex: number): void {
  const pl = state.players[playerIndex]!
  const need = Math.max(0, 5 - pl.hand.length)
  if (need > 0) drawToHand(state, playerIndex, need)
  state.filled = true
}

export function stockTop(pl: SkippoPlayer): SkippoCard | null {
  if (!pl.stock.length) return null
  return pl.stock[pl.stock.length - 1]!
}

export function createSkippoMatch(
  names: string[],
  computers: boolean[],
  variant: SkippoVariant = 'classic',
  seed = Date.now(),
): SkippoState {
  const n = clampSkippoPlayerCount(names.length)
  const config = skippoConfig(variant, n)
  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComp = computers.slice(0, n)
  while (useComp.length < n) useComp.push(true)

  const players: SkippoPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: Boolean(useComp[i]),
    hand: [],
    stock: [],
    discards: emptyDiscards(),
    score: 0,
  }))

  const state: SkippoState = {
    config,
    players,
    phase: 'play',
    current: 0,
    round: 1,
    draw: [],
    recycle: [],
    builders: emptyBuilders(),
    filled: false,
    winnerId: null,
    log: [],
    lastHandNote: null,
    lastHandScores: null,
    lastMessage: null,
  }
  return dealSkippoHand(state, seed)
}

export function dealSkippoHand(state: SkippoState, seed: number): SkippoState {
  const next = cloneSkippo(state)
  const n = next.players.length
  const stockN = next.config.stockSize
  next.builders = emptyBuilders()
  next.recycle = []
  next.filled = false
  next.winnerId = null
  next.lastHandNote = null
  next.lastHandScores = null
  next.phase = 'play'

  for (const pl of next.players) {
    pl.hand = []
    pl.stock = []
    pl.discards = emptyDiscards()
  }

  let deck = shuffleDeck(buildSkippoDeck(), seed)
  for (let s = 0; s < stockN; s++) {
    for (let p = 0; p < n; p++) {
      const c = deck[0]
      if (!c) break
      deck = deck.slice(1)
      next.players[p]!.stock.push(c)
    }
  }
  next.draw = deck
  next.current = (next.round - 1) % n
  refillHand(next, next.current)
  const label = skippoVariantLabel(next.config.variant)
  next.log = [
    `Hand ${next.round} — ${label}. ${next.players[next.current]!.name} leads.`,
  ]
  next.lastMessage = next.log[0]!
  return next
}

export function dealNextSkippoRound(state: SkippoState): SkippoState {
  if (state.phase !== 'roundEnd') return state
  const next = cloneSkippo(state)
  next.round += 1
  return dealSkippoHand(next, Date.now() % 1e9)
}

export function withPhysicalSeats(state: SkippoState, seats: number[]): SkippoState {
  const next = cloneSkippo(state)
  for (let i = 0; i < next.players.length; i++) {
    next.players[i]!.seat = seats[i] ?? i
  }
  return next
}

export function maybeWin(state: SkippoState, playerIndex: number): boolean {
  if (state.players[playerIndex]!.stock.length > 0) return false
  scoreStockOut(state, playerIndex)
  return true
}
