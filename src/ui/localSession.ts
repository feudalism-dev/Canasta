import { pumpComputers } from '../ai/computerTurns'
import type { AiDifficulty } from '../ai/heuristic'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { cloneState, createMatch } from '../core/state'
import { tryApply } from '../core/rules'
import { DEFAULT_HOUSE } from '../core/houseRules'
import type { ApplyResult, GameMove, HouseRules, MatchState, Variant } from '../core/types'
import { playDealSfx, playSfxForMove } from './sfx'

export type LocalControllers = {
  state: MatchState
  localIndex: number
  log: string[]
  aiThinking: boolean
  submit: (move: GameMove) => ApplyResult
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

/** AVsitter seat 0–3 is the solo player number. Chair 3 in a 2-hand setup still deals four. */
export function soloSeatCount(partnership: boolean, humanSeat: number): number {
  const seat = Number.isFinite(humanSeat) ? humanSeat : 0
  if (partnership || seat >= 2) return 4
  return 2
}

export function soloHumanIndex(humanSeat: number, playerCount: number): number {
  if (!Number.isFinite(humanSeat) || humanSeat < 0) return 0
  const seat = Math.floor(humanSeat)
  if (seat >= playerCount) return 0
  return seat
}

export function soloRoster(
  name: string,
  partnership: boolean,
  humanSeat: number,
): { names: string[]; humans: boolean[]; localIndex: number } {
  const n = soloSeatCount(partnership, humanSeat)
  const localIndex = soloHumanIndex(humanSeat, n)
  const names: string[] = []
  const humans: boolean[] = []
  let ai = 0
  for (let i = 0; i < n; i++) {
    if (i === localIndex) {
      names.push(name || 'You')
      humans.push(true)
    } else {
      names.push(COMPUTER_NAMES[ai] ?? `Computer ${i + 1}`)
      humans.push(false)
    }
    ai += 1
  }
  return { names, humans, localIndex }
}

export function startSolo(
  name: string,
  variant: Variant,
  partnership: boolean,
  difficulty: AiDifficulty,
  house: HouseRules = DEFAULT_HOUSE,
  humanSeat = 0,
): LocalControllers {
  const roster = soloRoster(name, partnership, humanSeat)
  let state = createMatch({ variant, names: roster.names, humans: roster.humans, house })
  const localIndex = roster.localIndex
  const log: string[] = [state.lastMessage]
  let aiThinking = false
  let cancelled = false
  let running = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const pushLog = (msg: string) => {
    log.unshift(msg)
    if (log.length > 14) log.length = 14
  }

  playDealSfx()

  const pumpAi = async () => {
    if (running || cancelled) return
    running = true
    try {
      await pumpComputers(state, difficulty, {
        isCancelled: () => cancelled,
        onThinking: (on) => {
          aiThinking = on
          notify()
        },
        onStep: ({ move, playerIndex, prev }) => {
          playSfxForMove(prev, state, move, playerIndex)
          pushLog(state.lastMessage)
          notify()
        },
      })
    } finally {
      aiThinking = false
      running = false
      notify()
    }
  }

  const session: LocalControllers = {
    get state() {
      return state
    },
    localIndex,
    get log() {
      return log
    },
    get aiThinking() {
      return aiThinking
    },
    submit(move) {
      const prev = cloneState(state)
      const res = tryApply(state, move, localIndex)
      if (!res.ok) {
        pushLog(res.error)
        notify()
        return res
      }
      playSfxForMove(prev, state, move, localIndex)
      pushLog(state.lastMessage)
      notify()
      void pumpAi()
      return { ok: true as const }
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy() {
      cancelled = true
      listeners.clear()
    },
  }
  void pumpAi()
  return session
}

/** Resume a solo match from a soft-leave snapshot (same seat / grace window). */
export function resumeSolo(saved: MatchState, localIndex: number, difficulty: AiDifficulty): LocalControllers {
  let state = cloneState(saved)
  const log: string[] = [state.lastMessage || 'Resumed.']
  let aiThinking = false
  let cancelled = false
  let running = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const pushLog = (msg: string) => {
    log.unshift(msg)
    if (log.length > 14) log.length = 14
  }

  const pumpAi = async () => {
    if (running || cancelled) return
    running = true
    try {
      await pumpComputers(state, difficulty, {
        isCancelled: () => cancelled,
        onThinking: (on) => {
          aiThinking = on
          notify()
        },
        onStep: ({ move, playerIndex, prev }) => {
          playSfxForMove(prev, state, move, playerIndex)
          pushLog(state.lastMessage)
          notify()
        },
      })
    } finally {
      aiThinking = false
      running = false
      notify()
    }
  }

  const session: LocalControllers = {
    get state() {
      return state
    },
    localIndex,
    get log() {
      return log
    },
    get aiThinking() {
      return aiThinking
    },
    submit(move) {
      const prev = cloneState(state)
      const res = tryApply(state, move, localIndex)
      if (!res.ok) {
        pushLog(res.error)
        notify()
        return res
      }
      playSfxForMove(prev, state, move, localIndex)
      pushLog(state.lastMessage)
      notify()
      void pumpAi()
      return { ok: true as const }
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy() {
      cancelled = true
      listeners.clear()
    },
  }
  void pumpAi()
  return session
}
