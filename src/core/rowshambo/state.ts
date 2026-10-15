import { buildRowShamBoDeck, shuffleDeck, sortHand } from './deck'
import { directionLabel, rowShamBoConfig, rowShamBoVariantLabel } from './variants'
import type {
  RowShamBoDirection,
  RowShamBoPlayer,
  RowShamBoState,
  RowShamBoVariant,
} from './types'

export const ACTION_TIMEOUT_MS = 60_000

export function cloneRowShamBo(state: RowShamBoState): RowShamBoState {
  return structuredClone(state)
}

export function createRowShamBoMatch(
  names: string[],
  computers: boolean[],
  variant: RowShamBoVariant = 'classic',
  playTo = 100,
  seed = Date.now(),
): RowShamBoState {
  const config = rowShamBoConfig(variant, names.length, playTo)
  const n = config.playerCount
  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComp = computers.slice(0, n)
  while (useComp.length < n) useComp.push(true)

  const players: RowShamBoPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: Boolean(useComp[i]),
    hand: [],
    passCardId: null,
    playCardId: null,
    gameScore: 0,
    matchScore: 0,
  }))

  const rng = seed
  const button = Math.abs(rng) % n

  const state: RowShamBoState = {
    config,
    players,
    phase: 'chooseDir',
    button,
    direction: null,
    stock: [],
    discard: [],
    tablePlays: players.map(() => null),
    revealed: players.map(() => false),
    handNumber: 0,
    gameNumber: 1,
    actionDeadline: null,
    resolveSteps: [],
    resolveStepIndex: -1,
    lastHandScores: null,
    winnerId: null,
    matchTied: false,
    log: [],
    lastMessage: null,
  }
  return dealNewGame(state, seed)
}

export function dealNewGame(state: RowShamBoState, seed: number): RowShamBoState {
  const next = cloneRowShamBo(state)
  next.stock = shuffleDeck(buildRowShamBoDeck(next.config.variant), seed)
  next.discard = []
  next.handNumber = 0
  next.resolveSteps = []
  next.resolveStepIndex = -1
  next.lastHandScores = null
  next.winnerId = null
  next.matchTied = false
  next.actionDeadline = null
  next.tablePlays = next.players.map(() => null)
  next.revealed = next.players.map(() => false)
  for (const pl of next.players) {
    pl.hand = []
    pl.passCardId = null
    pl.playCardId = null
    pl.gameScore = 0
  }
  // Deal 5 each
  const n = next.players.length
  for (let c = 0; c < 5; c++) {
    for (let p = 0; p < n; p++) {
      const card = next.stock[0]
      if (!card) break
      next.stock = next.stock.slice(1)
      next.players[p]!.hand.push(card)
    }
  }
  for (const pl of next.players) pl.hand = sortHand(pl.hand)
  return startHand(next, seed + 17)
}

export function pickDirection(seed: number): RowShamBoDirection {
  return seed % 2 === 0 ? 'cw' : 'ccw'
}

export function startHand(state: RowShamBoState, seed: number): RowShamBoState {
  const next = cloneRowShamBo(state)
  next.handNumber += 1
  next.direction = pickDirection(seed)
  next.phase = 'chooseDir'
  next.resolveSteps = []
  next.resolveStepIndex = -1
  next.lastHandScores = null
  next.actionDeadline = null
  next.tablePlays = next.players.map(() => null)
  next.revealed = next.players.map(() => false)
  for (const pl of next.players) {
    pl.passCardId = null
    pl.playCardId = null
  }
  const label = rowShamBoVariantLabel(next.config.variant)
  const dir = directionLabel(next.direction)
  const lead = next.players[next.button]!
  next.log.push(
    `Hand ${next.handNumber} — ${label}. Direction: ${dir}. Button: ${lead.name}.`,
  )
  next.lastMessage = `Randomizer… ${dir}! ${lead.name} has the button.`
  return next
}

export function drawUpToFive(state: RowShamBoState): void {
  for (const pl of state.players) {
    while (pl.hand.length < 5 && state.stock.length > 0) {
      const c = state.stock[0]!
      state.stock = state.stock.slice(1)
      pl.hand.push(c)
    }
    pl.hand = sortHand(pl.hand)
  }
}

export function withPhysicalSeats(state: RowShamBoState, seats: number[]): RowShamBoState {
  const next = cloneRowShamBo(state)
  for (let i = 0; i < next.players.length; i++) {
    next.players[i]!.seat = seats[i] ?? i
  }
  return next
}

export function passTargetSeat(
  from: number,
  n: number,
  dir: RowShamBoDirection,
): number {
  if (dir === 'cw') return (from + 1) % n
  return (from - 1 + n) % n
}
