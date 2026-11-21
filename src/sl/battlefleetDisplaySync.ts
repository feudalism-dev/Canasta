import type { BattleFleetState } from '../core/battlefleet/types'
import {
  battleFleetPublicBoardFromState,
  encodeBattleFleetPublicBoard,
} from '../core/battlefleet/publicBoard'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastTurn = -2
let lastBoardPosted = ''
let lastNames = ''
let lastScores = ''
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pending: {
  state: BattleFleetState
  slCap: string
  uid: string
  seat: number
} | null = null

export function battlefleetNamesPipe(state: BattleFleetState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = (p.name || '').replace(/\|/g, ' ')
  }
  return out
}

export function battlefleetScoresPipe(state: BattleFleetState): number[] {
  const out = [0, 0, 0, 0]
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.score
  }
  return out
}

async function flush(
  state: BattleFleetState,
  slCap: string,
  uid: string,
  seat: number,
): Promise<void> {
  const names = battlefleetNamesPipe(state)
  const namesKey = names.join('|')
  if (namesKey !== lastNames) {
    try {
      await tableSetNames(slCap, uid, seat, names)
      lastNames = namesKey
    } catch {
      /* CEF */
    }
  }

  const scores = battlefleetScoresPipe(state)
  const scoresKey = scores.join('|')
  if (scoresKey !== lastScores) {
    try {
      await tableEvent(slCap, uid, seat, `SCORE|${scores.join('|')}`)
      lastScores = scoresKey
    } catch {
      /* CEF */
    }
  }

  const turnSeat =
    state.phase === 'battle'
      ? (state.players.find((p) => p.id === state.turnPlayerId)?.seat ?? -1)
      : -1
  if (turnSeat !== lastTurn) {
    try {
      if (turnSeat < 0) {
        await tableEvent(slCap, uid, seat, 'TURN|0|0|NONE|0|')
      } else {
        await tableEvent(slCap, uid, seat, `TURN|${turnSeat + 1}|0|NONE|0|`)
      }
      lastTurn = turnSeat
    } catch {
      lastTurn = -2
    }
  }

  const board = battleFleetPublicBoardFromState(state)
  const compact = encodeBattleFleetPublicBoard(board)
  // Soft cap: if somehow huge, refuse posting rather than heap the table
  if (compact.length > 1800) {
    console.warn('[battlefleet] board wire too large', compact.length)
    return
  }
  if (compact !== lastBoardPosted) {
    try {
      await tableSetBoard(slCap, uid, seat, compact)
      lastBoardPosted = compact
    } catch {
      lastBoardPosted = ''
    }
  }

  if (state.phase === 'gameEnd' && state.lastMessage) {
    try {
      await tableEvent(
        slCap,
        uid,
        seat,
        `GAME_OVER|${state.lastMessage.replace(/\|/g, '/')}`,
      )
    } catch {
      /* CEF */
    }
  }
}

export function syncBattleFleetDisplay(
  state: BattleFleetState,
  slCap: string,
  uid: string,
  seat: number,
): void {
  pending = { state, slCap, uid, seat }
  if (timer) clearTimeout(timer)
  // Debounce harder than card games — board grows every shot
  timer = setTimeout(() => {
    void pump()
  }, 220)
}

async function pump(): Promise<void> {
  if (flushing || !pending) return
  flushing = true
  const job = pending
  pending = null
  try {
    await flush(job.state, job.slCap, job.uid, job.seat)
  } finally {
    flushing = false
    if (pending) void pump()
  }
}

export function resetBattleFleetDisplaySync(): void {
  lastTurn = -2
  lastBoardPosted = ''
  lastNames = ''
  lastScores = ''
  pending = null
  if (timer) clearTimeout(timer)
  timer = null
}
