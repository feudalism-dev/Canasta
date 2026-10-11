import { describe, expect, it } from 'vitest'
import {
  decodeYotsyPublicBoard,
  encodeYotsyPublicBoard,
  isYotsyBoardPayload,
  yotsyPublicBoardFromState,
} from './publicBoard'
import { applyYotsyMove } from './rules'
import { createYotsyMatch } from './state'

describe('yotsy public board', () => {
  it('round-trips after a roll', () => {
    let state = createYotsyMatch(['Ada', 'Bot'], [false, true], 'classic')
    const rolled = applyYotsyMove(state, { t: 'roll' })
    expect(rolled.ok).toBe(true)
    if (!rolled.ok) return
    state = rolled.state
    const board = yotsyPublicBoardFromState(state)
    const wire = encodeYotsyPublicBoard(board)
    expect(isYotsyBoardPayload(wire)).toBe(true)
    expect(wire.startsWith('Y1~')).toBe(true)
    const back = decodeYotsyPublicBoard(wire)
    expect(back.live).toBe(true)
    expect(back.dice).toHaveLength(5)
    expect(back.players[0]!.name).toBe('Ada')
  })
})
