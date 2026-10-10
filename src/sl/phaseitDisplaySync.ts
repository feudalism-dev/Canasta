import type { PhaseItState } from '../core/phaseit/types'
import {
  encodePhaseItPublicBoard,
  idlePhaseItPublicBoard,
  phaseItPublicBoardFromState,
} from '../core/phaseit/publicBoard'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastTurn = -2
let lastBoardPosted = ''
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pending: { state: PhaseItState; slCap: string; uid: string; seat: number } | null = null

export function phaseitNamesPipe(state: PhaseItState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = (p.name || '').replace(/\|/g, ' ')
  }
  return out
}

export function phaseitScoresPipe(state: PhaseItState): number[] {
  const out = [0, 0, 0, 0]
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.score
  }
  return out
}

async function flush(state: PhaseItState, slCap: string, uid: string, seat: number): Promise<void> {
  const names = phaseitNamesPipe(state)
  try {
    await tableSetNames(slCap, uid, seat, names)
  } catch {
    /* CEF / cap blip */
  }

  const scores = phaseitScoresPipe(state)
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
    state.phase === 'matchEnd' ? idlePhaseItPublicBoard() : phaseItPublicBoardFromState(state)
  const compact = encodePhaseItPublicBoard(board)
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
      await tableEvent(slCap, uid, seat, 'GAME_OVER|1|0|NONE|0|p')
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

/** Push Furware names / scores / turn + spectator BOARD from the Phase It HUD. */
export function syncPhaseItDisplay(
  state: PhaseItState,
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

export function resetPhaseItDisplaySync(): void {
  lastTurn = -2
  lastBoardPosted = ''
  pending = null
}
