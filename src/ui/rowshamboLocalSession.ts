import { fillRowShamBoBots } from '../ai/rowshamboBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyRowShamBoMove } from '../core/rowshambo/rules'
import { createRowShamBoMatch, withPhysicalSeats } from '../core/rowshambo/state'
import type { RowShamBoMove, RowShamBoState, RowShamBoVariant } from '../core/rowshambo/types'
import { clampMatchTarget, clampRowShamBoPlayerCount } from '../core/rowshambo/variants'

export type RowShamBoLocalSession = {
  state: RowShamBoState
  localIndex: number
  submit: (move: RowShamBoMove) => { ok: true } | { ok: false; error: string }
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function rowshamboSoloPhysicalSeats(humanSeat: number, playerCount: number): number[] {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
  const hs = ((humanSeat % 4) + 4) % 4
  const seats = [hs]
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (s !== hs) seats.push(s)
  }
  return seats
}

export function rowshamboSoloRoster(name: string, playerCount: number) {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startRowShamBoSolo(
  name: string,
  playerCount: number,
  variant: RowShamBoVariant = 'classic',
  playTo = 100,
  humanSeat = 0,
): RowShamBoLocalSession {
  const n = clampRowShamBoPlayerCount(playerCount)
  const target = clampMatchTarget(playTo)
  const roster = rowshamboSoloRoster(name, n)
  const seats = rowshamboSoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(
    createRowShamBoMatch(roster.names, roster.computers, variant, target),
    seats,
  )
  const localIndex = roster.localIndex
  let cancelled = false
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
      const res = applyRowShamBoMove(state, move)
      if (!res.ok) return res
      state = fillRowShamBoBots(res.state)
      notify()
      return { ok: true }
    },
    newMatch: () => {
      state = withPhysicalSeats(
        createRowShamBoMatch(roster.names, roster.computers, variant, target),
        seats,
      )
      notify()
    },
    onChange: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy: () => {
      cancelled = true
      listeners.clear()
      void cancelled
    },
  }
}
