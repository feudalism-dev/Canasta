import { pickAiMove } from '../ai/heuristic'
import type { AiDifficulty } from '../ai/heuristic'
import { createMatch } from '../core/state'
import { tryApply } from '../core/rules'
import type { GameMove, HouseRules, MatchState, Variant } from '../core/types'
import { DEFAULT_HOUSE } from '../core/types'

export type LocalControllers = {
  state: MatchState
  localIndex: number
  log: string[]
  aiThinking: boolean
  submit: (move: GameMove) => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

const AI_DELAY_MS = 900
const AI_NAMES = ['Brass', 'Velvet', 'Lamp Light'] as const

export function startSolo(
  name: string,
  variant: Variant,
  partnership: boolean,
  difficulty: AiDifficulty,
  house: HouseRules = DEFAULT_HOUSE,
): LocalControllers {
  const names = partnership
    ? [name || 'You', AI_NAMES[0], AI_NAMES[1], AI_NAMES[2]]
    : [name || 'You', AI_NAMES[0]]
  const humans = names.map((_, i) => i === 0)
  let state = createMatch({ variant, names, humans, house })
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
    const move = pickAiMove(state, who, difficulty)
    if (!move) return false
    tryApply(state, move, who)
    pushLog(state.lastMessage)
    return true
  }

  const pumpAi = async () => {
    if (running || cancelled) return
    running = true
    try {
      let guard = 0
      while (!cancelled && guard++ < 80) {
        if (aiIndex() == null) {
          aiThinking = false
          notify()
          return
        }
        aiThinking = true
        notify()
        await new Promise<void>((r) => setTimeout(r, AI_DELAY_MS))
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
    localIndex: 0,
    get log() {
      return log
    },
    get aiThinking() {
      return aiThinking
    },
    submit(move) {
      const res = tryApply(state, move, 0)
      if (!res.ok) {
        pushLog(res.error)
        notify()
        return
      }
      pushLog(state.lastMessage)
      notify()
      void pumpAi()
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
