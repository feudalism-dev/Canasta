import {
  WARFRONT_BOT_MS,
  fillWarfrontBots,
  warfrontBotShouldAct,
  warfrontBotStep,
} from '../ai/warfrontBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyWarfrontMove } from '../core/warfront/rules'
import { createWarfrontMatch, withPhysicalSeats } from '../core/warfront/state'
import type {
  WarfrontAlign,
  WarfrontDifficulty,
  WarfrontMove,
  WarfrontState,
  WarfrontTheater,
} from '../core/warfront/types'

export type WarfrontLocalSession = {
  state: WarfrontState
  localIndex: number
  submit: (move: WarfrontMove) => { ok: true } | { ok: false; error: string }
  newMatch: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

export function warfrontSoloPhysicalSeats(
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

export function warfrontSoloRoster(name: string, playerCount: number) {
  const n = Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
  const names: string[] = [name || 'You']
  const computers: boolean[] = [false]
  for (let i = 1; i < n; i++) {
    names.push(COMPUTER_NAMES[i - 1] ?? `Computer ${i}`)
    computers.push(true)
  }
  return { names, computers, localIndex: 0 }
}

export function startWarfrontSolo(
  name: string,
  playerCount: number,
  theater: WarfrontTheater = 'land',
  align: WarfrontAlign = 'ffa',
  difficulty: WarfrontDifficulty = 'normal',
  humanSeat = 0,
): WarfrontLocalSession {
  const n = align === 'teams' ? 4 : Math.max(2, Math.min(4, playerCount))
  const roster = warfrontSoloRoster(name, n)
  if (align === 'teams') {
    while (roster.names.length < 4) {
      roster.names.push(COMPUTER_NAMES[roster.names.length - 1] ?? 'Computer')
      roster.computers.push(true)
    }
  }
  const seats = warfrontSoloPhysicalSeats(humanSeat, n)
  let state = withPhysicalSeats(
    createWarfrontMatch(
      roster.names,
      roster.computers,
      theater,
      align,
      difficulty,
    ),
    seats,
  )
  state = fillWarfrontBots(state, { maxSteps: 0 })
  const localIndex = roster.localIndex
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  let botTimer: ReturnType<typeof setTimeout> | null = null

  const clearBotTimer = () => {
    if (botTimer != null) {
      clearTimeout(botTimer)
      botTimer = null
    }
  }

  const scheduleBots = () => {
    clearBotTimer()
    const step = () => {
      botTimer = null
      if (!warfrontBotShouldAct(state)) return
      const next = warfrontBotStep(state)
      if (next === state) return
      state = next
      notify()
      if (warfrontBotShouldAct(state)) {
        botTimer = setTimeout(step, WARFRONT_BOT_MS)
      }
    }
    if (warfrontBotShouldAct(state)) {
      botTimer = setTimeout(step, WARFRONT_BOT_MS)
    }
  }

  scheduleBots()

  return {
    get state() {
      return state
    },
    get localIndex() {
      return localIndex
    },
    submit: (move) => {
      const res = applyWarfrontMove(state, move)
      if (!res.ok) return res
      state = res.state
      notify()
      scheduleBots()
      return { ok: true }
    },
    newMatch: () => {
      clearBotTimer()
      state = withPhysicalSeats(
        createWarfrontMatch(
          roster.names,
          roster.computers,
          theater,
          align,
          difficulty,
        ),
        seats,
      )
      notify()
      scheduleBots()
    },
    onChange: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy: () => {
      clearBotTimer()
      listeners.clear()
    },
  }
}
