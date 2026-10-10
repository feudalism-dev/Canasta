import type { TrickState } from '../core/trick/types'
import {
  encodeTrickPublicBoard,
  idleTrickPublicBoard,
  trickPublicBoardFromState,
} from '../core/trick/publicBoard'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastTurn = -2
let lastBoardPosted = ''
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pending: { state: TrickState; slCap: string; uid: string; seat: number } | null = null

/** Four Furware slots from engine players (by physical `player.seat`). */
export function trickNamesPipe(state: TrickState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = (p.name || '').replace(/\|/g, ' ')
  }
  return out
}

export function trickScoresPipe(state: TrickState): number[] {
  const out = [0, 0, 0, 0]
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.score
  }
  return out
}

async function flush(state: TrickState, slCap: string, uid: string, seat: number): Promise<void> {
  const names = trickNamesPipe(state)
  try {
    await tableSetNames(slCap, uid, seat, names)
  } catch {
    /* CEF / cap blip */
  }

  const scores = trickScoresPipe(state)
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
    state.phase === 'matchEnd' ? idleTrickPublicBoard() : trickPublicBoardFromState(state)
  const compact = encodeTrickPublicBoard(board)
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
      await tableEvent(slCap, uid, seat, 'GAME_OVER|1|0|NONE|0|h')
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

/** Push Furware names / scores / turn + spectator BOARD from the Trick HUD. */
export function emitTrickDisplay(
  state: TrickState,
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

export function resetTrickDisplaySync(): void {
  lastTurn = -2
  lastBoardPosted = ''
  pending = null
}
