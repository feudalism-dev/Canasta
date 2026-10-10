import { describe, expect, it } from 'vitest'
import { buildSkippoDeck } from './deck'
import {
  decodeSkippoPublicBoard,
  encodeSkippoPublicBoard,
  skippoPublicBoardFromState,
} from './publicBoard'
import { applySkippoMove, legalPlays } from './rules'
import { createSkippoMatch, stockTop } from './state'

describe('Skippo deck', () => {
  it('builds 162 cards', () => {
    expect(buildSkippoDeck()).toHaveLength(162)
    expect(buildSkippoDeck().filter((c) => c.rank == null)).toHaveLength(18)
  })
})

describe('Classic Skippo', () => {
  it('deals stock of 30 and refills hand to 5', () => {
    const s = createSkippoMatch(['A', 'B'], [false, true], 'classic', 7)
    expect(s.players).toHaveLength(2)
    expect(s.players.every((p) => p.stock.length === 30)).toBe(true)
    expect(s.players[s.current]!.hand).toHaveLength(5)
    expect(s.phase).toBe('play')
    expect(s.config.playTo).toBe(500)
  })

  it('plays a matching hand card onto a builder', () => {
    let s = createSkippoMatch(['A', 'B'], [false, false], 'classic', 9)
    const me = s.current
    s.builders[0]!.next = 3
    s.players[me]!.hand = [
      { id: 'n3', rank: 3 },
      { id: 'n9', rank: 9 },
      { id: 'n10', rank: 10 },
      { id: 'n11', rank: 11 },
      { id: 'n12', rank: 12 },
    ]
    const legal = legalPlays(s, me)
    expect(legal.some((p) => p.card.id === 'n3' && p.builder === 0)).toBe(true)
    const res = applySkippoMove(s, { t: 'play', source: 'hand', cardId: 'n3', builder: 0 })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.builders[0]!.next).toBe(4)
    expect(s.players[me]!.hand.some((c) => c.id === 'n3')).toBe(false)
  })

  it('allows wild Skippo as any needed rank', () => {
    let s = createSkippoMatch(['A', 'B'], [false, false], 'classic', 11)
    const me = s.current
    s.builders[1]!.next = 7
    s.players[me]!.hand = [{ id: 'w', rank: null }, { id: 'a', rank: 2 }, { id: 'b', rank: 3 }, { id: 'c', rank: 4 }, { id: 'd', rank: 5 }]
    const res = applySkippoMove(s, { t: 'play', source: 'hand', cardId: 'w', builder: 1 })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.builders[1]!.next).toBe(8)
  })

  it('plays stock top and can win by emptying stock', () => {
    let s = createSkippoMatch(['A', 'B'], [false, false], 'classic', 13)
    const me = s.current
    const other = 1 - me
    s.builders[0]!.next = 1
    s.players[me]!.stock = [{ id: 'last', rank: 1 }]
    s.players[me]!.hand = [
      { id: 'h1', rank: 5 },
      { id: 'h2', rank: 6 },
      { id: 'h3', rank: 7 },
      { id: 'h4', rank: 8 },
      { id: 'h5', rank: 9 },
    ]
    s.players[other]!.stock = [
      { id: 'o1', rank: 2 },
      { id: 'o2', rank: null },
    ]
    expect(stockTop(s.players[me]!)?.id).toBe('last')
    const res = applySkippoMove(s, { t: 'play', source: 'stock', builder: 0 })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.players[me]!.stock).toHaveLength(0)
    expect(s.phase).toBe('roundEnd')
    expect(s.players[me]!.score).toBe(5 + 25)
  })

  it('discard ends the turn and refills the next player', () => {
    let s = createSkippoMatch(['A', 'B'], [false, false], 'classic', 15)
    const me = s.current
    const cardId = s.players[me]!.hand[0]!.id
    const res = applySkippoMove(s, { t: 'discard', cardId, discardIndex: 0 })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.current).toBe(1 - me)
    expect(s.players[s.current]!.hand.length).toBeGreaterThanOrEqual(5)
    expect(s.players[me]!.discards[0]).toHaveLength(1)
  })
})

describe('Skippo public board', () => {
  it('round-trips encode/decode', () => {
    const s = createSkippoMatch(['A', 'B', 'C'], [false, true, true], 'classic', 21)
    const board = skippoPublicBoardFromState(s)
    const wire = encodeSkippoPublicBoard(board)
    expect(wire.startsWith('K1~')).toBe(true)
    const back = decodeSkippoPublicBoard(wire)
    expect(back.live).toBe(true)
    expect(back.playerCount).toBe(3)
    expect(back.players).toHaveLength(3)
  })
})
