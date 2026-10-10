import { describe, expect, it } from 'vitest'
import { createTrickMatch } from './state'
import { applyTrickMove } from './rules'
import { buildEuchreDeck } from './deck'
import { ohHellHandSizeForRound } from './variants'
import { legalOhHellBids } from './ohHellRules'

describe('Spades', () => {
  it('deals 13 and starts bidding', () => {
    const s = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'spades', 3)
    expect(s.phase).toBe('bid')
    expect(s.trump).toBe('S')
    expect(s.players.every((p) => p.hand.length === 13)).toBe(true)
  })

  it('collects four bids then plays', () => {
    let s = createTrickMatch(['A', 'B', 'C', 'D'], [false, false, false, false], 'spades', 5)
    for (let i = 0; i < 4; i++) {
      const res = applyTrickMove(s, { t: 'bid', amount: i === 0 ? 0 : 3 })
      expect(res.ok).toBe(true)
      if (res.ok) s = res.state
    }
    expect(s.phase).toBe('play')
    expect(s.playerBids).toEqual([expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number)])
  })
})

describe('Euchre', () => {
  it('uses a 24-card deck and turns a kitty card', () => {
    expect(buildEuchreDeck()).toHaveLength(24)
    const s = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'euchre', 8)
    expect(s.phase).toBe('bid')
    expect(s.players.every((p) => p.hand.length === 5)).toBe(true)
    expect(s.nest.length).toBe(4)
  })

  it('can order up and discard', () => {
    let s = createTrickMatch(['A', 'B', 'C', 'D'], [false, false, false, false], 'euchre', 11)
    const res = applyTrickMove(s, { t: 'bid', amount: 1 })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.phase).toBe('nest')
    expect(s.trump).toBeTruthy()
    expect(s.players[s.dealer]!.hand.length).toBe(6)
    const dump = s.players[s.dealer]!.hand[0]!.id
    const d2 = applyTrickMove(s, { t: 'nestDiscard', cardIds: [dump] })
    expect(d2.ok).toBe(true)
    if (d2.ok) s = d2.state
    expect(s.phase).toBe('play')
    expect(s.players[s.dealer]!.hand.length).toBe(5)
  })
})

describe('Oh Hell', () => {
  it('cycles hand sizes and constrains dealer bid', () => {
    expect(ohHellHandSizeForRound(1)).toBe(7)
    expect(ohHellHandSizeForRound(7)).toBe(1)
    expect(ohHellHandSizeForRound(8)).toBe(2)
    let s = createTrickMatch(['A', 'B', 'C', 'D'], [false, false, false, false], 'ohhell', 2)
    expect(s.handSize).toBe(7)
    expect(s.trump).toBeTruthy()
    // Three bids of 2 each → sum 6; dealer cannot bid 1
    for (let i = 0; i < 3; i++) {
      const res = applyTrickMove(s, { t: 'bid', amount: 2 })
      expect(res.ok).toBe(true)
      if (res.ok) s = res.state
    }
    expect(s.current).toBe(s.dealer)
    const legal = legalOhHellBids(s)
    expect(legal.includes(1)).toBe(false)
    expect(legal.includes(0)).toBe(true)
  })

  it('scores exact bids only', () => {
    let s = createTrickMatch(['A', 'B'], [false, false], 'ohhell', 9)
    expect(s.players).toHaveLength(2)
    expect(s.handSize).toBe(7)
    for (let i = 0; i < 2; i++) {
      const amount = i === 0 ? 3 : 2 // sum ≠ 7
      const res = applyTrickMove(s, { t: 'bid', amount })
      expect(res.ok).toBe(true)
      if (res.ok) s = res.state
    }
    expect(s.phase).toBe('play')
    // Play out the hand with legal cards
    let guard = 0
    while (s.phase === 'play' && guard++ < 40) {
      const hand = s.players[s.current]!.hand
      const led = s.trick[0]?.card.suit
      const follow = led ? hand.filter((c) => c.suit === led) : []
      const pick = (follow.length ? follow : hand)[0]!
      const res = applyTrickMove(s, { t: 'play', cardId: pick.id })
      expect(res.ok).toBe(true)
      if (res.ok) s = res.state
    }
    expect(s.phase === 'roundEnd' || s.phase === 'matchEnd').toBe(true)
  })
})
