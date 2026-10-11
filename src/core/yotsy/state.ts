import { turnsNeeded } from './categories'
import { freshDice, rollDice } from './dice'
import { playerTotal } from './score'
import { yotsyConfig, yotsyVariantLabel } from './variants'
import type { YotsyPlayer, YotsyState, YotsyVariant } from './types'

export function cloneYotsy(state: YotsyState): YotsyState {
  return structuredClone(state)
}

export function currentPlayer(state: YotsyState): YotsyPlayer {
  return state.players[state.current]!
}

export function createYotsyMatch(
  names: string[],
  computers: boolean[],
  variant: YotsyVariant = 'classic',
  seed = Date.now(),
): YotsyState {
  const config = yotsyConfig(variant, names.length)
  const n = config.playerCount
  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComp = computers.slice(0, n)
  while (useComp.length < n) useComp.push(true)

  const players: YotsyPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: Boolean(useComp[i]),
    card: {},
    yahtzeeBonuses: 0,
    turnsDone: 0,
  }))

  const state: YotsyState = {
    config,
    players,
    phase: 'play',
    current: 0,
    round: 1,
    dice: freshDice(),
    rollsLeft: 3,
    hasRolled: false,
    winnerId: null,
    log: [],
    lastMessage: null,
    lastScoreNote: null,
  }

  const label = yotsyVariantLabel(variant)
  const cur = players[0]!
  const boxes = turnsNeeded(variant)
  state.log = [`${label} — ${n} players · ${boxes} boxes. ${cur.name} starts.`]
  state.lastMessage = state.log[0]!
  void seed
  return state
}

export function beginTurn(state: YotsyState): void {
  state.dice = freshDice()
  state.rollsLeft = 3
  state.hasRolled = false
  state.lastScoreNote = null
  const cur = state.players[state.current]!
  state.lastMessage = `${cur.name}'s turn — roll the dice.`
}

/** Advance to next player; end match if all cards complete. */
export function advanceAfterScore(state: YotsyState): void {
  const need = turnsNeeded(state.config.variant)
  const allDone = state.players.every((p) => p.turnsDone >= need)
  if (allDone) {
    state.phase = 'matchEnd'
    const ranked = [...state.players].sort(
      (a, b) => playerTotal(b, state.config.variant) - playerTotal(a, state.config.variant),
    )
    const champ = ranked[0]!
    state.winnerId = champ.id
    state.lastMessage = `${champ.name} wins with ${playerTotal(champ, state.config.variant)} points!`
    state.log.push(state.lastMessage)
    return
  }
  let next = (state.current + 1) % state.players.length
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[next]!.turnsDone < need) break
    next = (next + 1) % state.players.length
  }
  state.current = next
  state.round += 1
  beginTurn(state)
}

export function withPhysicalSeats(state: YotsyState, seats: number[]): YotsyState {
  const next = cloneYotsy(state)
  for (let i = 0; i < next.players.length; i++) {
    next.players[i]!.seat = seats[i] ?? i
  }
  return next
}

export function rerollPreview(state: YotsyState, seed: number): YotsyState['dice'] {
  return rollDice(state.dice, seed)
}
