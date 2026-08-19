import { encodePublicBoard, publicBoardFromMatch } from '../core/publicBoard'
import { cloneState } from '../core/state'
import { eventsForMove } from '../core/displayEvents'
import type { GameMove, MatchState } from '../core/types'
import { tableEvent, tableSetBoard, tableSetNames } from './tableApi'

let lastBoardPosted = ''
let lastNamesPosted = ''
let boardTimer: ReturnType<typeof setTimeout> | null = null
let pending: { state: MatchState; slCap: string; uid: string; seat: number } | null = null

function namesPipe(state: MatchState): string[] {
  const out = ['', '', '', '']
  for (const p of state.players) {
    if (p.seat >= 0 && p.seat < 4) out[p.seat] = p.displayName || ''
  }
  return out
}

async function flushBoard(
  state: MatchState,
  slCap: string,
  uid: string,
  seat: number,
): Promise<void> {
  const names = namesPipe(state)
  const nameKey = names.join('|')
  if (nameKey !== lastNamesPosted) {
    try {
      await tableSetNames(slCap, uid, seat, names)
      lastNamesPosted = nameKey
    } catch {
      lastNamesPosted = ''
    }
  }
  const compact = encodePublicBoard(publicBoardFromMatch(state))
  if (compact === lastBoardPosted) return
  try {
    await tableSetBoard(slCap, uid, seat, compact)
    lastBoardPosted = compact
  } catch {
    lastBoardPosted = ''
  }
}

export function emitPublicBoard(
  state: MatchState,
  slCap: string,
  uid: string,
  seat: number,
): void {
  pending = { state, slCap, uid, seat }
  if (boardTimer) return
  boardTimer = setTimeout(() => {
    boardTimer = null
    const job = pending
    pending = null
    if (!job) return
    void flushBoard(job.state, job.slCap, job.uid, job.seat)
  }, 280)
}

export async function emitDisplayPipes(
  prev: MatchState | null,
  next: MatchState,
  move: GameMove | null,
  playerIndex: number,
  slCap: string,
  uid: string,
  seat: number,
): Promise<void> {
  if (!prev || !move) return
  const pipes = eventsForMove(prev, next, move, playerIndex)
  for (const p of pipes) {
    try {
      await tableEvent(slCap, uid, seat, p)
    } catch {
      /* CEF / cap blip */
    }
  }
}

export { cloneState }
