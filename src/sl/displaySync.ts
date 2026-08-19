import { encodePublicBoard, publicBoardFromMatch } from '../core/publicBoard'
import { cloneState } from '../core/state'
import { eventsForMove } from '../core/displayEvents'
import type { GameMove, MatchState } from '../core/types'
import { tableEvent, tableSetBoard } from './tableApi'

export async function emitPublicBoard(
  state: MatchState,
  slCap: string,
  uid: string,
  seat: number,
): Promise<void> {
  const compact = encodePublicBoard(publicBoardFromMatch(state))
  try {
    await tableSetBoard(slCap, uid, seat, compact)
  } catch {
    /* CEF / cap blip */
  }
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
