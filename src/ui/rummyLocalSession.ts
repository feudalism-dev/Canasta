import { pumpRummyBots } from '../ai/rummyBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyRummyMove } from '../core/rummy/rules'
import { createRummyMatch, dealNextRummyRound } from '../core/rummy/state'
import type { RummyMove, RummyState, RummyVariant } from '../core/rummy/types'

export type RummyLocalSession = {
  state: RummyState
  localIndex: number
  aiThinking: boolean
  submit: (move: RummyMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

/** Total seats 2–4 = 1 human + (n−1) bots. Human is always seat/index 0 in solo. */
export function rummySoloRoster(
  name: string,
  playerCount: number,
): { names: string[]; computers: boolean[]; localIndex: number } {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startRummySolo(
  name: string,
  playerCount: number,
  variant: RummyVariant = 'standard',
): RummyLocalSession {
  const roster = rummySoloRoster(name, playerCount)
  let state = createRummyMatch(roster.names, roster.computers, variant)
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
      state = await pumpRummyBots(state, {
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
      notify()
    }
  }

  void pump()

  return {
    get state() {
      return state
    },
    localIndex,
    get aiThinking() {
      return aiThinking
    },
    submit: (move) => {
      if (cancelled) return { ok: false, error: 'Session ended' }
      if (state.current !== localIndex) return { ok: false, error: 'Not your turn' }
      const res = applyRummyMove(state, move)
      if (!res.ok) return res
      state = res.state
      notify()
      void pump()
      return { ok: true }
    },
    nextHand: () => {
      if (cancelled) return
      if (state.phase !== 'roundEnd') return
      state = dealNextRummyRound(state)
      notify()
      void pump()
    },
    newMatch: () => {
      if (cancelled) return
      state = createRummyMatch(roster.names, roster.computers, variant)
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
