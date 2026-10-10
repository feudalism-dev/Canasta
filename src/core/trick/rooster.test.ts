import { describe, expect, it } from 'vitest'
import { createTrickMatch, dealNextTrickRound } from './state'
import { applyTrickMove } from './rules'
import { ROOSTER_MIN_BID, roosterCounterPoints, buildRoosterDeck } from './roosterDeck'
import { suggestedBids } from './roosterRules'

describe('Rooster partnership', () => {
  it('builds a 41-card deck with 120 counter points', () => {
    const deck = buildRoosterDeck()
    expect(deck).toHaveLength(41)
    expect(deck.reduce((s, c) => s + roosterCounterPoints(c), 0)).toBe(120)
  })

  it('runs bid → nest → trump → play lead', () => {
    let state = createTrickMatch(['A', 'B', 'C', 'D'], [false, false, false, false], 'rooster', 42)
    expect(state.phase).toBe('bid')
    const starter = state.current

    // Three passes then forced-style bid from remaining
    for (let i = 0; i < 3; i++) {
      if (state.current === state.dealer && state.bidAmount === 0) break
      const res = applyTrickMove(state, { t: 'passBid' })
      expect(res.ok).toBe(true)
      if (res.ok) state = res.state
    }
    if (state.phase === 'bid') {
      const res = applyTrickMove(state, { t: 'bid', amount: ROOSTER_MIN_BID })
      expect(res.ok).toBe(true)
      if (res.ok) state = res.state
    }
    expect(state.phase).toBe('nest')
    expect(state.bidderIndex).toBe(state.current)
    expect(state.players[state.current]!.hand.length).toBe(14)

    const bury = state.players[state.current]!.hand.slice(0, 5).map((c) => c.id)
    let res = applyTrickMove(state, { t: 'nestDiscard', cardIds: bury })
    expect(res.ok).toBe(true)
    if (res.ok) state = res.state
    expect(state.phase).toBe('trump')
    expect(state.nest).toHaveLength(5)

    res = applyTrickMove(state, { t: 'nameTrump', suit: 'H' })
    expect(res.ok).toBe(true)
    if (res.ok) state = res.state
    expect(state.phase).toBe('play')
    expect(state.trump).toBe('H')
    expect(state.current).toBe(state.bidderIndex)

    const lead = state.players[state.current]!.hand[0]!
    res = applyTrickMove(state, { t: 'play', cardId: lead.id })
    expect(res.ok).toBe(true)
    if (res.ok) state = res.state
    expect(state.trick).toHaveLength(1)
    expect(starter).toBeGreaterThanOrEqual(0)
  })

  it('suggested bids beat current', () => {
    const state = createTrickMatch(['A', 'B', 'C', 'D'], [true, true, true, true], 'rooster', 2)
    state.bidAmount = 80
    const bids = suggestedBids(state)
    expect(bids[0]).toBe(85)
    expect(bids[bids.length - 1]).toBe(120)
  })

  it('rotates dealer on next hand', () => {
    const a = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'rooster', 9)
    expect(a.dealer).toBe(0)
    const b = dealNextTrickRound(a, 10)
    expect(b.dealer).toBe(1)
    expect(b.phase).toBe('bid')
  })
})
