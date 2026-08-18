import { cloneState } from '../core/state'
import { eventsForMove } from '../core/displayEvents'
import type { GameMove, MatchState } from '../core/types'
import { tableEvent } from './tableApi'

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
