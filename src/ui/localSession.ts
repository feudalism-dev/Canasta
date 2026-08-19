import { pickAiMove } from '../ai/heuristic'
import type { AiDifficulty } from '../ai/heuristic'
import { createMatch } from '../core/state'
import { forcePass, getLegalMoves, tryApply } from '../core/rules'
import type { ApplyResult, GameMove, HouseRules, MatchState, Variant } from '../core/types'
import { DEFAULT_HOUSE } from '../core/types'

export type LocalControllers = {
  state: MatchState
  localIndex: number
  log: string[]
  aiThinking: boolean
  submit: (move: GameMove) => ApplyResult
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

/** Pause once when a new computer player starts, then finish their turn quickly. */
const AI_THINK_MS = 380
const AI_NAMES = ['Brass', 'Velvet', 'Lamp Light'] as const

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
      names.push(AI_NAMES[ai] ?? `Computer ${i + 1}`)
      humans.push(false)
      ai += 1
    }
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

  const aiIndex = (): number | null => {
    if (state.phase === 'matchEnd' || state.phase === 'roundEnd') return null
    if (state.phase === 'awaitingGoOutConsent' && state.pendingGoOut) {
      const pending = state.pendingGoOut.playerIndex
      const partner = state.players.findIndex((p, i) => p.team === state.players[pending]!.team && i !== pending)
      if (partner >= 0 && !state.players[partner]!.isHuman) return partner
      return null
    }
    const cur = state.players[state.currentPlayer]
    if (cur && !cur.isHuman) return state.currentPlayer
    return null
  }

  const stepAi = (): boolean => {
    const who = aiIndex()
    if (who == null) return false
    if (state.phase === 'awaitingGoOutConsent') {
      const move =
        pickAiMove(state, who, difficulty) ??
        getLegalMoves(state, who).find((m) => m.kind === 'consentGoOut') ??
        null
      if (!move) return false
      const res = tryApply(state, move, who)
      if (res.ok) pushLog(state.lastMessage)
      return res.ok
    }
    const move =
      pickAiMove(state, who, difficulty) ??
      getLegalMoves(state, who).find((m) => m.kind === 'discard') ??
      null
    if (move) {
      const res = tryApply(state, move, who)
      if (res.ok) {
        pushLog(state.lastMessage)
        return true
      }
    }
    const discard = getLegalMoves(state, who).find((m) => m.kind === 'discard')
    if (discard) {
      tryApply(state, discard, who)
      pushLog(state.lastMessage)
      return true
    }
    forcePass(state)
    pushLog(state.lastMessage)
    return true
  }

  const pumpAi = async () => {
    if (running || cancelled) return
    running = true
    try {
      let guard = 0
      let lastWho = -1
      while (!cancelled && guard++ < 80) {
        const who = aiIndex()
        if (who == null) {
          aiThinking = false
          notify()
          return
        }
        if (who !== lastWho) {
          aiThinking = true
          notify()
          await new Promise<void>((r) => setTimeout(r, AI_THINK_MS))
          lastWho = who
        }
        if (cancelled) return
        if (!stepAi()) break
        notify()
      }
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
      const res = tryApply(state, move, localIndex)
      if (!res.ok) {
        pushLog(res.error)
        notify()
        return res
      }
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
