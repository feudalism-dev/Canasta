import { describe, expect, it } from 'vitest'
import { buildIchiDeck } from './deck'
import { applyIchiMove, legalPlays } from './rules'
import { createIchiMatch, topCard } from './state'

describe('Ichi deck', () => {
  it('builds 108 cards', () => {
    expect(buildIchiDeck()).toHaveLength(108)
  })
})

describe('Classic Ichi', () => {
  it('deals 7 and starts on play', () => {
    const s = createIchiMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'classic', 3)
    expect(s.players).toHaveLength(4)
    expect(s.players.every((p) => p.hand.length === 7)).toBe(true)
    expect(s.phase).toBe('play')
    expect(topCard(s)).toBeTruthy()
    expect(s.stock.length).toBeGreaterThan(0)
  })

  it('supports 2 players and reverse acts as skip', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'classic', 11)
    expect(s.players).toHaveLength(2)
    // Force a reverse onto discard matching color by injecting
    const me = s.current
    const rev = {
      id: 'test-rev',
      color: s.currentColor,
      kind: 'reverse' as const,
    }
    s.players[me]!.hand = [rev, ...s.players[me]!.hand]
    const before = s.current
    const res = applyIchiMove(s, { t: 'play', cardId: 'test-rev' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.current).toBe(before)
  })

  it('blocks WDF when holding the current color', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'classic', 22)
    const me = s.current
    const color = s.currentColor
    s.players[me]!.hand = [
      { id: 'wdf1', color: null, kind: 'wdf' },
      { id: 'c1', color, kind: '5' },
    ]
    const legal = legalPlays(s, me)
    expect(legal.some((c) => c.kind === 'wdf')).toBe(false)
    const bad = applyIchiMove(s, { t: 'play', cardId: 'wdf1' })
    expect(bad.ok).toBe(false)
  })

  it('allows WDF when no color match and opens challenge after color', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'classic', 33)
    const me = s.current
    const otherColor = (['R', 'Y', 'G', 'B'] as const).find((c) => c !== s.currentColor)!
    s.players[me]!.hand = [
      { id: 'wdf1', color: null, kind: 'wdf' },
      { id: 'c1', color: otherColor, kind: '5' },
    ]
    const res = applyIchiMove(s, { t: 'play', cardId: 'wdf1' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.phase).toBe('colorPick')
    expect(s.wdfLegal).toBe(true)
    const c2 = applyIchiMove(s, { t: 'chooseColor', color: otherColor })
    expect(c2.ok).toBe(true)
    if (c2.ok) s = c2.state
    expect(s.phase).toBe('challenge')
    const acc = applyIchiMove(s, { t: 'acceptWdf' })
    expect(acc.ok).toBe(true)
    if (acc.ok) s = acc.state
    expect(s.phase).toBe('play')
    expect(s.players[s.challengeTarget == null ? 1 - me : 0]!.hand.length).toBeGreaterThanOrEqual(7)
  })

  it('requires Call Ichi again after drawing past one card', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'classic', 55)
    const me = s.current
    const other = 1 - me
    s.currentColor = 'R'
    s.discard = [{ id: 'top', color: 'R', kind: '3' }]
    s.players[me]!.hand = [
      { id: 'a', color: 'R', kind: '5' },
      { id: 'b', color: 'R', kind: '6' },
    ]
    s.players[other]!.hand = [
      { id: 'o1', color: 'Y', kind: '4' },
      { id: 'o2', color: 'Y', kind: '7' },
    ]
    let res = applyIchiMove(s, { t: 'play', cardId: 'a' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.ichiPending).toBe(me)
    expect(s.ichiCalled[me]).toBe(false)
    res = applyIchiMove(s, { t: 'callIchi' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.ichiCalled[me]).toBe(true)
    expect(s.ichiPending).toBeNull()
    // Opponent plays a +2 so we draw and leave the one-card streak
    s.current = other
    s.phase = 'play'
    s.players[other]!.hand = [{ id: 'd2', color: 'R', kind: 'draw2' }, ...s.players[other]!.hand]
    res = applyIchiMove(s, { t: 'play', cardId: 'd2' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.players[me]!.hand.length).toBeGreaterThan(1)
    expect(s.ichiCalled[me]).toBe(false)
    // Back to us with two cards of matching color — drop to one again
    s.current = me
    s.phase = 'play'
    s.currentColor = 'R'
    s.discard = [{ id: 'top2', color: 'R', kind: '9' }]
    s.players[me]!.hand = [
      { id: 'c', color: 'R', kind: '2' },
      { id: 'd', color: 'R', kind: '8' },
    ]
    res = applyIchiMove(s, { t: 'play', cardId: 'c' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.players[me]!.hand).toHaveLength(1)
    expect(s.ichiPending).toBe(me)
    expect(s.ichiCalled[me]).toBe(false)
    res = applyIchiMove(s, { t: 'callIchi' })
    expect(res.ok).toBe(true)
  })

  it('scores when a player empties their hand', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'classic', 44)
    const me = s.current
    const color = s.currentColor
    s.players[me]!.hand = [{ id: 'last', color, kind: '3' }]
    s.players[1 - me]!.hand = [
      { id: 'x1', color: 'R', kind: '9' },
      { id: 'x2', color: null, kind: 'wild' },
    ]
    const res = applyIchiMove(s, { t: 'play', cardId: 'last' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.phase).toBe('roundEnd')
    expect(s.players[me]!.score).toBe(9 + 50)
  })
})
