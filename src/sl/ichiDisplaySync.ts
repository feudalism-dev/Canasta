import type { IchiState } from '../core/ichi/types'
import {
  encodeIchiPublicBoard,
  idleIchiPublicBoard,
  ichiPublicBoardFromState,
} from '../core/ichi/publicBoard'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastTurn = -2
let lastBoardPosted = ''
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pending: { state: IchiState; slCap: string; uid: string; seat: number } | null = null

export function ichiNamesPipe(state: IchiState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = (p.name || '').replace(/\|/g, ' ')
  }
  return out
}

export function ichiScoresPipe(state: IchiState): number[] {
  const out = [0, 0, 0, 0]
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.score
  }
  return out
}

async function flush(state: IchiState, slCap: string, uid: string, seat: number): Promise<void> {
  const names = ichiNamesPipe(state)
  try {
    await tableSetNames(slCap, uid, seat, names)
  } catch {
    /* CEF / cap blip */
  }

  const scores = ichiScoresPipe(state)
  try {
    await tableEvent(slCap, uid, seat, `SCORE|${scores.join('|')}`)
  } catch {
    /* CEF / cap blip */
  }

  const cur = state.players[state.current]
  const turnSeat =
    state.phase === 'roundEnd' || state.phase === 'matchEnd' || !cur ? -1 : cur.seat
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
    state.phase === 'matchEnd' ? idleIchiPublicBoard() : ichiPublicBoardFromState(state)
  const compact = encodeIchiPublicBoard(board)
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
      await tableEvent(slCap, uid, seat, 'GAME_OVER|1|0|NONE|0|i')
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

/** Push Furware names / scores / turn + spectator BOARD from the Ichi HUD. */
export function syncIchiDisplay(
  state: IchiState,
  slCap: string,
  uid: string,
  seat: number,
): void {
  pending = { state, slCap, uid, seat }
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void pump()
  }, 280)
}

export function resetIchiDisplaySync(): void {
  lastTurn = -2
  lastBoardPosted = ''
  pending = null
}
