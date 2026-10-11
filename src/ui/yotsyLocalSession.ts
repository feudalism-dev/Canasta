import { pumpYotsyBots } from '../ai/yotsyBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyYotsyMove } from '../core/yotsy/rules'
import { createYotsyMatch, withPhysicalSeats } from '../core/yotsy/state'
import type { YotsyMove, YotsyState, YotsyVariant } from '../core/yotsy/types'
import { clampYotsyPlayerCount } from '../core/yotsy/variants'

export type YotsyLocalSession = {
  state: YotsyState
  localIndex: number
  aiThinking: boolean
  submit: (move: YotsyMove) => { ok: true } | { ok: false; error: string }
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function yotsySoloPhysicalSeats(humanSeat: number, playerCount: number): number[] {
  const n = Math.max(1, Math.min(4, Math.floor(playerCount) || 2))
  const hs = ((humanSeat % 4) + 4) % 4
  const seats = [hs]
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (s !== hs) seats.push(s)
  }
  return seats
}

export function yotsySoloRoster(name: string, playerCount: number) {
  const n = Math.max(1, Math.min(4, Math.floor(playerCount) || 2))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startYotsySolo(
  name: string,
  playerCount: number,
  variant: YotsyVariant = 'classic',
  humanSeat = 0,
): YotsyLocalSession {
  const n = clampYotsyPlayerCount(playerCount)
  const roster = yotsySoloRoster(name, n)
  const seats = yotsySoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(createYotsyMatch(roster.names, roster.computers, variant), seats)
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
      state = await pumpYotsyBots(state, {
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
      const res = applyYotsyMove(state, move)
      if (!res.ok) return res
      state = res.state
      notify()
      void pump()
      return { ok: true }
    },
    newMatch: () => {
      state = withPhysicalSeats(createYotsyMatch(roster.names, roster.computers, variant), seats)
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
