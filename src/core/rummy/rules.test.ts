import { describe, expect, it } from 'vitest'
import { makeCard } from '../cards'
import { applyRummyMove } from './rules'
import { createRummyMatch } from './state'

describe('rummy rules', () => {
  it('deals seven cards and allows stock draw then discard', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'standard', 42)
    expect(state.players[0]!.hand).toHaveLength(7)
    expect(state.players[1]!.hand).toHaveLength(7)
    expect(state.phase).toBe('draw')
    const drew = applyRummyMove(state, { t: 'drawStock' })
    expect(drew.ok).toBe(true)
    if (!drew.ok) return
    expect(drew.state.drew).toBe(true)
    expect(drew.state.players[0]!.hand).toHaveLength(8)
    const cardId = drew.state.players[0]!.hand[0]!.id
    const disc = applyRummyMove(drew.state, { t: 'discard', cardId })
    expect(disc.ok).toBe(true)
    if (!disc.ok) return
    expect(disc.state.current).toBe(1)
    expect(disc.state.phase).toBe('draw')
  })

  it('allows laying off onto an existing meld and going out', () => {
    let state = createRummyMatch(['You', 'Bot'], [false, true], 'standard', 7)
    state = structuredClone(state)
    state.drew = true
    state.phase = 'meld'
    state.current = 0
    state.players[0]!.melds = [
      {
        id: 'm0-0',
        kind: 'set',
        cards: [makeCard(0, 'H', '7', 0), makeCard(0, 'D', '7', 0), makeCard(0, 'S', '7', 0)],
      },
    ]
    const last = makeCard(0, 'C', '7', 0)
    state.players[0]!.hand = [last]
    state.players[1]!.hand = [makeCard(0, 'H', '2', 0), makeCard(0, 'D', '3', 0)]

    const res = applyRummyMove(state, {
      t: 'layoff',
      meldOwnerSeat: 0,
      meldId: 'm0-0',
      cardIds: [last.id],
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.players[0]!.hand).toHaveLength(0)
    expect(res.state.players[0]!.melds[0]!.cards).toHaveLength(4)
    expect(res.state.phase).toBe('roundEnd')
    expect(res.state.lastHandScores).toHaveLength(2)
    expect(res.state.lastHandScores!.find((l) => l.playerId === 'p0')?.delta).toBe(0)
    expect(res.state.lastHandScores!.find((l) => l.playerId === 'p1')?.delta).toBe(5) // 2+3
    expect(res.state.players[1]!.score).toBe(5)
  })

  it('allows laying off onto an opponent meld', () => {
    let state = createRummyMatch(['You', 'Bot'], [false, true], 'standard', 11)
    state = structuredClone(state)
    state.drew = true
    state.phase = 'meld'
    state.current = 0
    state.players[1]!.melds = [
      {
        id: 'm1-0',
        kind: 'run',
        cards: [makeCard(0, 'H', '5', 0), makeCard(0, 'H', '6', 0), makeCard(0, 'H', '7', 0)],
      },
    ]
    const add = makeCard(0, 'H', '8', 0)
    state.players[0]!.hand = [add, makeCard(0, 'D', 'K', 0)]

    const res = applyRummyMove(state, {
      t: 'layoff',
      meldOwnerSeat: 1,
      meldId: 'm1-0',
      cardIds: [add.id],
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.players[0]!.hand).toHaveLength(1)
    expect(res.state.players[1]!.melds[0]!.cards).toHaveLength(4)
    expect(res.state.phase).toBe('meld')
  })
})
