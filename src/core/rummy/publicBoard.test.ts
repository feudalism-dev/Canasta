import { describe, expect, it } from 'vitest'
import { makeCard } from '../cards'
import { createRummyMatch } from './state'
import {
  decodeRummyPublicBoard,
  encodeRummyPublicBoard,
  isRummyBoardPayload,
  rummyPublicBoardFromState,
} from './publicBoard'

describe('rummy public board', () => {
  it('round-trips a live standard deal', () => {
    let state = createRummyMatch(['Alice', 'Bot'], [false, true], 'standard', 21)
    state = structuredClone(state)
    state.players[0]!.melds = [
      {
        id: 'm0-0',
        kind: 'run',
        cards: [
          makeCard(0, 'H', '7', 0),
          makeCard(0, 'H', '5', 0),
          makeCard(0, 'H', '6', 0),
        ],
      },
    ]
    state.players[0]!.hand = state.players[0]!.hand.slice(0, 4)
    state.phase = 'meld'
    state.drew = true

    const pub = rummyPublicBoardFromState(state)
    const wire = encodeRummyPublicBoard(pub)
    expect(isRummyBoardPayload(wire)).toBe(true)
    expect(wire.startsWith('R1~1~')).toBe(true)

    const again = decodeRummyPublicBoard(wire)
    expect(again.live).toBe(true)
    expect(again.variant).toBe('standard')
    expect(again.players).toHaveLength(2)
    expect(again.melds).toHaveLength(1)
    expect(again.melds[0]!.cards.map((c) => c.rank)).toEqual(['5', '6', '7'])
    expect(again.stock).toBe(pub.stock)
    expect(again.top?.rank).toBe(pub.top?.rank)
  })

  it('encodes idle as R1~0~', () => {
    expect(encodeRummyPublicBoard(decodeRummyPublicBoard('R1~0~'))).toBe('R1~0~')
  })
})
