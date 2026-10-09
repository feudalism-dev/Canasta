import { describe, expect, it } from 'vitest'
import { applyTrickMove, legalPlays } from './rules'
import { createTrickMatch, indexWithTwoOfClubs } from './state'

describe('Hearts', () => {
  it('deals 13 cards to four players', () => {
    const state = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'hearts', 9)
    expect(state.players).toHaveLength(4)
    for (const p of state.players) expect(p.hand).toHaveLength(13)
    expect(state.config.playTo).toBe(100)
  })

  it('requires a 3-card pass then 2♣ lead', () => {
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
    const leader = indexWithTwoOfClubs(state)
    expect(state.current).toBe(leader)
    const legal = legalPlays(state, leader)
    expect(legal).toHaveLength(1)
    expect(legal[0]!.suit).toBe('C')
    expect(legal[0]!.rank).toBe('2')
  })

  it('rejects rooster until implemented', () => {
    expect(() =>
      createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'rooster', 1),
    ).toThrow(/not playable/)
  })
})
