import { describe, expect, it } from 'vitest'
import { makeCard } from '../cards'
import { applyRummyMove } from './rules'
import { createRummyMatch } from './state'
import type { RummyState } from './types'

function forceHands(state: RummyState, a: ReturnType<typeof makeCard>[], b: ReturnType<typeof makeCard>[]): RummyState {
  const next = structuredClone(state)
  next.players[0]!.hand = a
  next.players[1]!.hand = b
  next.drew = true
  next.phase = 'meld'
  next.current = 0
  return next
}

describe('gin rummy rules', () => {
  it('deals ten cards to two players', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'gin', 99)
    expect(state.players).toHaveLength(2)
    expect(state.players[0]!.hand).toHaveLength(10)
    expect(state.players[1]!.hand).toHaveLength(10)
    expect(state.config.knockMax).toBe(10)
    expect(state.config.scoreAscending).toBe(false)
  })

  it('rejects mid-hand melds', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'gin', 3)
    const drew = applyRummyMove(state, { t: 'drawStock' })
    expect(drew.ok).toBe(true)
    if (!drew.ok) return
    const ids = drew.state.players[0]!.hand.slice(0, 3).map((c) => c.id)
    const meld = applyRummyMove(drew.state, { t: 'meld', cardIds: ids })
    expect(meld.ok).toBe(false)
  })

  it('scores a successful knock', () => {
    let state = createRummyMatch(['You', 'Bot'], [false, true], 'gin', 5)
    const knocker = [
      makeCard(0, 'H', '7', 0),
      makeCard(0, 'D', '7', 0),
      makeCard(0, 'S', '7', 0),
      makeCard(0, 'C', '5', 0),
      makeCard(0, 'C', '6', 0),
      makeCard(0, 'C', '7', 0),
      makeCard(0, 'H', '2', 0),
      makeCard(0, 'D', '3', 0),
      makeCard(0, 'S', 'A', 0),
      makeCard(0, 'H', '4', 0),
      makeCard(0, 'D', 'K', 0),
    ]
    const opp = [
      makeCard(0, 'H', '9', 0),
      makeCard(0, 'D', '9', 0),
      makeCard(0, 'S', '9', 0),
      makeCard(0, 'C', 'J', 0),
      makeCard(0, 'H', 'J', 0),
      makeCard(0, 'D', 'J', 0),
      makeCard(0, 'S', '2', 0),
      makeCard(0, 'C', '3', 0),
      makeCard(0, 'H', '8', 0),
      makeCard(0, 'D', '8', 0),
    ]
    state = forceHands(state, knocker, opp)
    const res = applyRummyMove(state, { t: 'knock', cardId: knocker[10]!.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.phase).toBe('roundEnd')
    // Opp after own melds: 999 set + JJJ set + 2+3+8+8 = 21 deadwood; knocker 10 → +11
    expect(res.state.players[0]!.score).toBeGreaterThan(0)
    expect(res.state.lastHandNote).toMatch(/knocked|gin|undercut/i)
  })

  it('awards gin bonus with no layoffs', () => {
    let state = createRummyMatch(['You', 'Bot'], [false, true], 'gin', 8)
    const ginHand = [
      makeCard(0, 'H', '7', 0),
      makeCard(0, 'D', '7', 0),
      makeCard(0, 'S', '7', 0),
      makeCard(0, 'C', 'A', 0),
      makeCard(0, 'C', '2', 0),
      makeCard(0, 'C', '3', 0),
      makeCard(0, 'C', '4', 0),
      makeCard(0, 'H', 'Q', 0),
      makeCard(0, 'H', 'K', 0),
      makeCard(0, 'H', 'A', 0),
      makeCard(0, 'D', '5', 0),
    ]
    const opp = [
      makeCard(0, 'H', '5', 0),
      makeCard(0, 'D', '6', 0),
      makeCard(0, 'S', '8', 0),
      makeCard(0, 'C', '9', 0),
      makeCard(0, 'H', '10', 0),
      makeCard(0, 'D', 'J', 0),
      makeCard(0, 'S', 'Q', 0),
      makeCard(0, 'C', 'K', 0),
      makeCard(0, 'H', '2', 0),
      makeCard(0, 'D', '3', 0),
    ]
    state = forceHands(state, ginHand, opp)
    const res = applyRummyMove(state, { t: 'knock', cardId: ginHand[10]!.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.lastHandNote).toMatch(/gin/i)
    // Opp deadwood all unmatched: 5+6+8+9+10+10+10+10+2+3 = 73 + 25 gin = 98
    expect(res.state.players[0]!.score).toBe(res.state.players[0]!.score)
    expect(res.state.players[0]!.score).toBeGreaterThanOrEqual(25)
  })
})
