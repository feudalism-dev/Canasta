import { describe, expect, it } from 'vitest'
import { applyTrickMove, legalPlays } from './rules'
import { createTrickMatch, indexWithLeadCard } from './state'
import { heartsHandSize } from './variants'

describe('Hearts', () => {
  it('deals 13 cards to four players', () => {
    const state = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'hearts', 9)
    expect(state.players).toHaveLength(4)
    for (const p of state.players) expect(p.hand).toHaveLength(13)
    expect(state.config.playTo).toBe(100)
  })

  it('supports 2- and 3-player deals', () => {
    const two = createTrickMatch(['A', 'B'], [false, true], 'hearts', 11)
    expect(two.players).toHaveLength(2)
    expect(two.config.playerCount).toBe(2)
    for (const p of two.players) expect(p.hand).toHaveLength(heartsHandSize(2))

    const three = createTrickMatch(['A', 'B', 'C'], [false, true, true], 'hearts', 12)
    expect(three.players).toHaveLength(3)
    for (const p of three.players) expect(p.hand).toHaveLength(17)
  })

  it('requires a 3-card pass then a lead', () => {
    let state = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'hearts', 3)
    expect(state.phase).toBe('pass')
    while (state.phase === 'pass') {
      const me = state.players[state.current]!
      const ids = me.hand.slice(0, 3).map((c) => c.id)
      const res = applyTrickMove(state, { t: 'pass', cardIds: ids })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      state = res.state
    }
    expect(state.phase).toBe('play')
    const leader = indexWithLeadCard(state)
    expect(state.current).toBe(leader)
    const legal = legalPlays(state, leader)
    expect(legal.length).toBeGreaterThan(0)
  })

  it('deals Rooster with nest and bid phase', () => {
    const state = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'rooster', 1)
    expect(state.config.variant).toBe('rooster')
    expect(state.phase).toBe('bid')
    expect(state.nest).toHaveLength(5)
    expect(state.players.every((p) => p.hand.length === 9)).toBe(true)
  })
})
