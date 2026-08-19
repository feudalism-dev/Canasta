import { describe, expect, it } from 'vitest'
import { createMatch } from './state'
import {
  decodePublicBoard,
  encodePublicBoard,
  idlePublicBoard,
  isIdleBoardPayload,
  publicBoardFromMatch,
  publicMeldsAsEngine,
} from './publicBoard'
import { teamOfSeat } from './variants'

describe('public board snapshot', () => {
  it('partners seats 1 and 3 (indexes 0 and 2)', () => {
    expect(teamOfSeat(0)).toBe(teamOfSeat(2))
    expect(teamOfSeat(1)).toBe(teamOfSeat(3))
    expect(teamOfSeat(0)).not.toBe(teamOfSeat(1))
  })

  it('round-trips a dealt four-hand match without hole cards', () => {
    const state = createMatch({
      variant: 'handAndFoot',
      names: ['Ada Lovelace', 'Brass', 'Vel', 'Lamp'],
      humans: [true, false, false, false],
      seed: 42,
    })
    state.teams[0]!.melds = [
      {
        rank: 'K',
        cards: [
          { id: 'secret-k1', rank: 'K', suit: 'H' },
          { id: 'secret-k2', rank: 'K', suit: 'S' },
          { id: 'secret-k3', rank: 'K', suit: 'D' },
        ],
        closed: false,
      },
    ]
    state.discard = [{ id: 'top', rank: '9', suit: 'H' }]
    state.discardFrozen = true
    const board = publicBoardFromMatch(state)
    expect(board.players[0]!.seat).toBe(0)
    expect(board.players[2]!.team).toBe(0)
    expect(board.players[1]!.team).toBe(1)
    expect(board.top).toEqual({ rank: '9', suit: 'H' })
    expect(board.frozen).toBe(true)
    expect(encodePublicBoard(board)).not.toMatch(/secret-/)
    expect(encodePublicBoard(board)).not.toMatch(/\|/)
    const again = decodePublicBoard(encodePublicBoard(board))
    expect(again.live).toBe(true)
    expect(again.variant).toBe('handAndFoot')
    expect(again.players.map((p) => p.name)).toEqual(['Ada Lovelace', 'Brass', 'Vel', 'Lamp'])
    expect(again.players[0]!.handCount).toBe(state.players[0]!.hand.length)
    expect(again.teams[0]!.melds[0]).toEqual({ rank: 'K', count: 3, kind: 'open', faces: 'KKK' })
    expect(again.top).toEqual({ rank: '9', suit: 'H' })
    expect(again.frozen).toBe(true)
  })

  it('decodes empty payload as idle attract', () => {
    expect(decodePublicBoard('')).toEqual(idlePublicBoard())
    expect(decodePublicBoard(encodePublicBoard(idlePublicBoard())).live).toBe(false)
    expect(isIdleBoardPayload(encodePublicBoard(idlePublicBoard()))).toBe(true)
    expect(isIdleBoardPayload('')).toBe(false)
    expect(isIdleBoardPayload('BOARD leftover')).toBe(false)
  })

  it('synthesizes face-up meld cards for the tray', () => {
    const melds = publicMeldsAsEngine([{ rank: 'Q', count: 7, kind: 'clean' }])
    expect(melds[0]!.cards).toHaveLength(7)
    expect(melds[0]!.closed).toBe(true)
    expect(melds[0]!.cards.every((c) => c.rank === 'Q')).toBe(true)
  })

  it('round-trips wilds in an open meld as JJJ2*', () => {
    const state = createMatch({
      variant: 'canasta',
      names: ['Ada', 'Brass', 'Vel', 'Lamp'],
      humans: [true, false, false, false],
      seed: 7,
    })
    state.teams[0]!.melds = [
      {
        rank: 'J',
        cards: [
          { id: 'j1', rank: 'J', suit: 'H' },
          { id: 'j2', rank: 'J', suit: 'S' },
          { id: 'j3', rank: 'J', suit: 'D' },
          { id: 'w2', rank: '2', suit: 'C' },
          { id: 'jk', rank: 'JOKER', suit: 'J' },
        ],
        closed: false,
      },
    ]
    const encoded = encodePublicBoard(publicBoardFromMatch(state))
    expect(encoded).toContain('JoJJJ2*')
    const again = decodePublicBoard(encoded)
    expect(again.teams[0]!.melds[0]).toEqual({ rank: 'J', count: 5, kind: 'open', faces: 'JJJ2*' })
    const cards = publicMeldsAsEngine(again.teams[0]!.melds)[0]!.cards
    expect(cards.map((c) => c.rank)).toEqual(['J', 'J', 'J', '2', 'JOKER'])
  })

  it('still paints a legacy count-only meld token', () => {
    const board = decodePublicBoard('1~1~c~1~5000~p~0~40~1~0~9H~hi^Ada:0:11:-1^0:1:0:Jo5;0:0:0:')
    expect(board.teams[0]!.melds[0]).toEqual({ rank: 'J', count: 5, kind: 'open' })
  })
})
