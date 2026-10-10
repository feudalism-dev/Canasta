import { pumpIchiBots } from '../ai/ichiBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyIchiMove } from '../core/ichi/rules'
import { createIchiMatch, dealNextIchiRound, withPhysicalSeats } from '../core/ichi/state'
import type { IchiMove, IchiState, IchiVariant } from '../core/ichi/types'
import { clampIchiPlayerCount } from '../core/ichi/variants'

export type IchiLocalSession = {
  state: IchiState
  localIndex: number
  aiThinking: boolean
  submit: (move: IchiMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function ichiSoloPhysicalSeats(humanSeat: number, playerCount: number): number[] {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const hs = ((humanSeat % 4) + 4) % 4
  const seats = [hs]
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (s !== hs) seats.push(s)
  }
  return seats
}

export function ichiSoloRoster(name: string, playerCount: number) {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 4))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startIchiSolo(
  name: string,
  playerCount: number,
  variant: IchiVariant = 'classic',
  humanSeat = 0,
): IchiLocalSession {
  const n = clampIchiPlayerCount(playerCount)
  const roster = ichiSoloRoster(name, n)
  const seats = ichiSoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(createIchiMatch(roster.names, roster.computers, variant), seats)
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
      state = await pumpIchiBots(state, {
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
      // Call Ichi is legal off-turn while pending; other moves still go through rules.
      const res = applyIchiMove(state, move)
      if (!res.ok) return res
      state = res.state
      notify()
      void pump()
      return { ok: true }
    },
    nextHand: () => {
      state = dealNextIchiRound(state)
      notify()
      void pump()
    },
    newMatch: () => {
      state = withPhysicalSeats(createIchiMatch(roster.names, roster.computers, variant), seats)
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
