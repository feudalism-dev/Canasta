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
