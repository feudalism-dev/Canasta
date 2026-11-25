import type { WarfrontState } from '../core/warfront/types'
import {
  encodeWarfrontPublicBoard,
  warfrontPublicBoardFromState,
} from '../core/warfront/publicBoard'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastTurn = -2
let lastBoardPosted = ''
let lastNames = ''
let lastScores = ''
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pending: {
  state: WarfrontState
  slCap: string
  uid: string
  seat: number
} | null = null

export function warfrontNamesPipe(state: WarfrontState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = (p.name || '').replace(/\|/g, ' ')
  }
  return out
}

export function warfrontScoresPipe(state: WarfrontState): number[] {
  const out = [0, 0, 0, 0]
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.vp
  }
  return out
}

async function flush(
  state: WarfrontState,
  slCap: string,
  uid: string,
  seat: number,
): Promise<void> {
  const names = warfrontNamesPipe(state)
  const namesKey = names.join('|')
  if (namesKey !== lastNames) {
    try {
      await tableSetNames(slCap, uid, seat, names)
      lastNames = namesKey
    } catch {
      /* CEF */
    }
  }

  const scores = warfrontScoresPipe(state)
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
    state.phase !== 'gameEnd'
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

  const board = warfrontPublicBoardFromState(state)
  const compact = encodeWarfrontPublicBoard(board)
  if (compact.length > 1500) {
    console.warn('[warfront] board wire too large', compact.length)
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

export function syncWarfrontDisplay(
  state: WarfrontState,
  slCap: string,
  uid: string,
  seat: number,
): void {
  pending = { state, slCap, uid, seat }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void pumpWarfrontDisplay()
  }, 180)
}

async function pumpWarfrontDisplay(): Promise<void> {
  if (flushing || !pending) return
  flushing = true
  const job = pending
  pending = null
  try {
    await flush(job.state, job.slCap, job.uid, job.seat)
  } finally {
    flushing = false
    if (pending) void pumpWarfrontDisplay()
  }
}

export function resetWarfrontDisplaySync(): void {
  lastTurn = -2
  lastBoardPosted = ''
  lastNames = ''
  lastScores = ''
  if (timer) clearTimeout(timer)
  timer = null
  pending = null
  flushing = false
}
