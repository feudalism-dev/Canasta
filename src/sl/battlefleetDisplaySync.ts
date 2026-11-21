import type { BattleFleetState } from '../core/battlefleet/types'
import {
  battleFleetPublicBoardFromState,
  type BattleFleetPublicBoard,
} from '../core/battlefleet/publicBoard'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastTurn = -2
let lastBoardPosted = ''
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

/** Compact public board for MoAP tableSetBoard (JSON). */
export function encodeBattleFleetPublicBoard(board: BattleFleetPublicBoard): string {
  return JSON.stringify(board)
}

async function flush(
  state: BattleFleetState,
  slCap: string,
  uid: string,
  seat: number,
): Promise<void> {
  const names = battlefleetNamesPipe(state)
  try {
    await tableSetNames(slCap, uid, seat, names)
  } catch {
    /* CEF */
  }

  const scores = battlefleetScoresPipe(state)
  try {
    await tableEvent(slCap, uid, seat, `SCORE|${scores.join('|')}`)
  } catch {
    /* CEF */
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

  const board =
    state.phase === 'gameEnd'
      ? battleFleetPublicBoardFromState(state)
      : battleFleetPublicBoardFromState(state)
  const compact = encodeBattleFleetPublicBoard(board)
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
      await tableEvent(slCap, uid, seat, `GAME_OVER|${state.lastMessage}`)
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
  timer = setTimeout(() => {
    void pump()
  }, 80)
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
  pending = null
  if (timer) clearTimeout(timer)
  timer = null
}
