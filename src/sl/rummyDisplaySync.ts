import type { RummyState } from '../core/rummy/types'
import { tableEvent, tableSetNames } from './tableApi'

let lastTurn = -2
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pending: { state: RummyState; slCap: string; uid: string; seat: number } | null = null

/** Four Furware slots from engine players (by physical `player.seat`). */
export function rummyNamesPipe(state: RummyState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = (p.name || '').replace(/\|/g, ' ')
  }
  return out
}

export function rummyScoresPipe(state: RummyState): number[] {
  const out = [0, 0, 0, 0]
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.score
  }
  return out
}

async function flush(state: RummyState, slCap: string, uid: string, seat: number): Promise<void> {
  const names = rummyNamesPipe(state)
  // Always refresh names/scores so a stand→re-sit or Display reset can repaint Furware.
  try {
    await tableSetNames(slCap, uid, seat, names)
  } catch {
    /* CEF / cap blip */
  }

  const scores = rummyScoresPipe(state)
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

  if (state.phase === 'matchEnd') {
    const game = state.config.variant === 'gin' ? 'g' : 'r'
    try {
      await tableEvent(slCap, uid, seat, `GAME_OVER|1|0|NONE|0|${game}`)
    } catch {
      /* ignore */
    }
    lastTurn = -2
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

/** Push Furware names / per-seat scores / turn from the Rummy HUD. */
export function emitRummyDisplay(
  state: RummyState,
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

export function resetRummyDisplaySync(): void {
  lastTurn = -2
  pending = null
}
