import { fillBattleFleetBots } from '../ai/battlefleetBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyBattleFleetMove } from '../core/battlefleet/rules'
import { createBattleFleetMatch, withPhysicalSeats } from '../core/battlefleet/state'
import type {
  BattleFleetDifficulty,
  BattleFleetMode,
  BattleFleetMove,
  BattleFleetState,
} from '../core/battlefleet/types'

export type BattleFleetLocalSession = {
  state: BattleFleetState
  localIndex: number
  submit: (move: BattleFleetMove) => { ok: true } | { ok: false; error: string }
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function battlefleetSoloPhysicalSeats(
  humanSeat: number,
  playerCount: number,
): number[] {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
  const hs = ((humanSeat % 4) + 4) % 4
  const seats = [hs]
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (s !== hs) seats.push(s)
  }
  return seats
}

export function battlefleetSoloRoster(name: string, playerCount: number) {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startBattleFleetSolo(
  name: string,
  playerCount: number,
  mode: BattleFleetMode = 'ffa',
  difficulty: BattleFleetDifficulty = 'normal',
  humanSeat = 0,
): BattleFleetLocalSession {
  const n = mode === 'teams' ? 4 : Math.max(2, Math.min(4, playerCount))
  const roster = battlefleetSoloRoster(name, n)
  // Team mode with 1 human: computers fill remaining 3
  if (mode === 'teams') {
    while (roster.names.length < 4) {
      roster.names.push(COMPUTER_NAMES[roster.names.length - 1] ?? `Computer`)
      roster.computers.push(true)
    }
  }
  const seats = battlefleetSoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(
    createBattleFleetMatch(roster.names, roster.computers, mode, difficulty),
    seats,
  )
  state = fillBattleFleetBots(state)
  const localIndex = roster.localIndex
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())

  return {
    get state() {
      return state
    },
    get localIndex() {
      return localIndex
    },
    submit: (move) => {
      const res = applyBattleFleetMove(state, move)
      if (!res.ok) return res
      state = fillBattleFleetBots(res.state)
      notify()
      return { ok: true }
    },
    newMatch: () => {
      state = withPhysicalSeats(
        createBattleFleetMatch(roster.names, roster.computers, mode, difficulty),
        seats,
      )
      state = fillBattleFleetBots(state)
      notify()
    },
    onChange: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy: () => {
      listeners.clear()
    },
  }
}
