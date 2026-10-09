import { pumpTrickBots } from '../ai/trickBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyTrickMove } from '../core/trick/rules'
import { createTrickMatch, dealNextTrickRound, withPhysicalSeats } from '../core/trick/state'
import type { TrickMove, TrickState, TrickVariant } from '../core/trick/types'
import { clampTrickPlayerCount } from '../core/trick/variants'

export type TrickLocalSession = {
  state: TrickState
  localIndex: number
  aiThinking: boolean
  submit: (move: TrickMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function trickSoloPhysicalSeats(humanSeat: number, playerCount: number): number[] {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const hs = ((humanSeat % 4) + 4) % 4
  const seats = [hs]
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (s !== hs) seats.push(s)
  }
  return seats
}

export function trickSoloRoster(name: string, playerCount: number) {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startTrickSolo(
  name: string,
  playerCount: number,
  variant: TrickVariant = 'hearts',
  humanSeat = 0,
): TrickLocalSession {
  const n = clampTrickPlayerCount(variant, playerCount)
  const roster = trickSoloRoster(name, n)
  const seats = trickSoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(createTrickMatch(roster.names, roster.computers, variant), seats)
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
      state = await pumpTrickBots(state, {
        isCancelled: () => cancelled,
        onThinking: (on) => {
          aiThinking = on
          notify()
        },
        onStep: (next) => {
          state = next
          notify()
        },
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
      const res = applyTrickMove(state, move)
      if (!res.ok) return res
      state = res.state
      notify()
      void pump()
      return { ok: true }
    },
    nextHand: () => {
      state = dealNextTrickRound(state)
      notify()
      void pump()
    },
    newMatch: () => {
      state = withPhysicalSeats(createTrickMatch(roster.names, roster.computers, variant), seats)
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
