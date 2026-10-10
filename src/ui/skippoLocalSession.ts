import { pumpSkippoBots } from '../ai/skippoBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applySkippoMove } from '../core/skippo/rules'
import { createSkippoMatch, dealNextSkippoRound, withPhysicalSeats } from '../core/skippo/state'
import type { SkippoMove, SkippoState, SkippoVariant } from '../core/skippo/types'
import { clampSkippoPlayerCount } from '../core/skippo/variants'

export type SkippoLocalSession = {
  state: SkippoState
  localIndex: number
  aiThinking: boolean
  submit: (move: SkippoMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function skippoSoloPhysicalSeats(humanSeat: number, playerCount: number): number[] {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const hs = ((humanSeat % 4) + 4) % 4
  const seats = [hs]
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (s !== hs) seats.push(s)
  }
  return seats
}

export function skippoSoloRoster(name: string, playerCount: number) {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startSkippoSolo(
  name: string,
  playerCount: number,
  variant: SkippoVariant = 'classic',
  humanSeat = 0,
): SkippoLocalSession {
  const n = clampSkippoPlayerCount(playerCount, variant)
  const roster = skippoSoloRoster(name, n)
  const seats = skippoSoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(createSkippoMatch(roster.names, roster.computers, variant), seats)
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
      state = await pumpSkippoBots(state, {
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
      const res = applySkippoMove(state, move)
      if (!res.ok) return res
      state = res.state
      notify()
      void pump()
      return { ok: true }
    },
    nextHand: () => {
      state = dealNextSkippoRound(state)
      notify()
      void pump()
    },
    newMatch: () => {
      state = withPhysicalSeats(createSkippoMatch(roster.names, roster.computers, variant), seats)
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
