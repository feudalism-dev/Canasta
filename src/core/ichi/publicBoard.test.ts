import { describe, expect, it } from 'vitest'
import {
  decodeIchiPublicBoard,
  encodeIchiPublicBoard,
  ichiPublicBoardFromState,
  isIchiBoardPayload,
} from './publicBoard'
import { createIchiMatch } from './state'

describe('Ichi public board', () => {
  it('round-trips I1~ payload', () => {
    const s = createIchiMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'classic', 7)
    const pub = ichiPublicBoardFromState(s)
    const wire = encodeIchiPublicBoard(pub)
    expect(isIchiBoardPayload(wire)).toBe(true)
    expect(wire.startsWith('I1~1~')).toBe(true)
    const again = decodeIchiPublicBoard(wire)
    expect(again.live).toBe(true)
    expect(again.playerCount).toBe(4)
    expect(again.players).toHaveLength(4)
    expect(again.currentColor).toBe(pub.currentColor)
    expect(again.topDiscard?.kind).toBe(pub.topDiscard?.kind)
  })

  it('encodes idle', () => {
    expect(encodeIchiPublicBoard(decodeIchiPublicBoard('I1~0~'))).toBe('I1~0~')
  })
})
