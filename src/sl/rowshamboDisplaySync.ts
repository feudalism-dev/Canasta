import type { RowShamBoState } from '../core/rowshambo/types'
import {
  encodeRowShamBoPublicBoard,
  idleRowShamBoPublicBoard,
  rowShamBoPublicBoardFromState,
} from '../core/rowshambo/publicBoard'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastTurn = -2
let lastBoardPosted = ''
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pending: { state: RowShamBoState; slCap: string; uid: string; seat: number } | null = null

export function rowshamboNamesPipe(state: RowShamBoState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = (p.name || '').replace(/\|/g, ' ')
  }
  return out
}

export function rowshamboScoresPipe(state: RowShamBoState): number[] {
  const out = [0, 0, 0, 0]
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.matchScore
  }
  return out
}

async function flush(state: RowShamBoState, slCap: string, uid: string, seat: number): Promise<void> {
  const names = rowshamboNamesPipe(state)
  try {
    await tableSetNames(slCap, uid, seat, names)
  } catch {
    /* CEF / cap blip */
  }

  const scores = rowshamboScoresPipe(state)
  try {
    await tableEvent(slCap, uid, seat, `SCORE|${scores.join('|')}`)
  } catch {
    /* CEF / cap blip */
  }

  const turnSeat =
    state.phase === 'matchEnd' || state.phase === 'pass' || state.phase === 'play'
      ? -1
      : state.players[state.button]?.seat ?? -1
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
    state.phase === 'matchEnd'
      ? idleRowShamBoPublicBoard()
      : rowShamBoPublicBoardFromState(state)
  const compact = encodeRowShamBoPublicBoard(board)
  if (compact !== lastBoardPosted) {
    try {
      await tableSetBoard(slCap, uid, seat, compact)
      lastBoardPosted = compact
    } catch {
      lastBoardPosted = ''
    }
  }

  if (state.phase === 'matchEnd') {
    try {
      await tableEvent(slCap, uid, seat, 'GAME_OVER|1|0|NONE|0|w')
    } catch {
      /* ignore */
    }
    lastTurn = -2
    lastBoardPosted = ''
  }
}

async function pump(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    while (pending) {
      const job = pending
      pending = null
      await flush(job.state, job.slCap, job.uid, job.seat)
    }
  } finally {
    flushing = false
  }
  if (pending) void pump()
}

export function syncRowShamBoDisplay(
  state: RowShamBoState,
  slCap: string,
  uid: string,
  seat: number,
): void {
  pending = { state, slCap, uid, seat }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void pump()
  }, 80)
}

export function resetRowShamBoDisplaySync(): void {
  lastTurn = -2
  lastBoardPosted = ''
  pending = null
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
