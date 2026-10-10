import { pumpPhaseItBots } from '../ai/phaseitBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyPhaseItMove } from '../core/phaseit/rules'
import { createPhaseItMatch, dealNextPhaseItRound, withPhysicalSeats } from '../core/phaseit/state'
import type { PhaseItMove, PhaseItState, PhaseItVariant } from '../core/phaseit/types'
import { clampPhaseItPlayerCount } from '../core/phaseit/variants'

export type PhaseItLocalSession = {
  state: PhaseItState
  localIndex: number
  aiThinking: boolean
  submit: (move: PhaseItMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function phaseitSoloPhysicalSeats(humanSeat: number, playerCount: number): number[] {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const hs = ((humanSeat % 4) + 4) % 4
  const seats = [hs]
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (s !== hs) seats.push(s)
  }
  return seats
}

export function phaseitSoloRoster(name: string, playerCount: number) {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startPhaseItSolo(
  name: string,
  playerCount: number,
  variant: PhaseItVariant = 'classic',
  humanSeat = 0,
): PhaseItLocalSession {
  const n = clampPhaseItPlayerCount(playerCount)
  const roster = phaseitSoloRoster(name, n)
  const seats = phaseitSoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(createPhaseItMatch(roster.names, roster.computers, variant), seats)
  const localIndex = roster.localIndex
  let aiThinking = false
  let cancelled = false
  let running = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())

  const pump = async () => {
    if (running || cancelled) return
    running = true
    try {
      state = await pumpPhaseItBots(state, {
        isCancelled: () => cancelled,
        onThinking: (on) => {
          aiThinking = on
          notify()
        },
        onStep: (next) => {
          state = next
          notify()
        },
        getState: () => state,
      })
    } finally {
      running = false
      aiThinking = false
    }
    notify()
  }

  void pump()

  return {
    get state() {
      return state
    },
    get localIndex() {
      return localIndex
    },
    get aiThinking() {
      return aiThinking
    },
    submit: (move) => {
      const res = applyPhaseItMove(state, move)
      if (!res.ok) return res
      state = res.state
      notify()
      void pump()
      return { ok: true }
    },
    nextHand: () => {
      state = dealNextPhaseItRound(state)
      notify()
      void pump()
    },
    newMatch: () => {
      state = withPhysicalSeats(createPhaseItMatch(roster.names, roster.computers, variant), seats)
      notify()
      void pump()
    },
    onChange: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy: () => {
      cancelled = true
      listeners.clear()
    },
  }
}
