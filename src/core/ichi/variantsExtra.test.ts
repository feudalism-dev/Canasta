import { describe, expect, it } from 'vitest'
import { applyIchiMove, legalPlays } from './rules'
import { createIchiMatch, topCard } from './state'

describe('Crazy Eights', () => {
  it('treats 8 as a wild color change', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'eights', 3)
    const me = s.current
    s.players[me]!.hand = [
      { id: 'e8', color: 'R', kind: '8' },
      { id: 'e5', color: 'Y', kind: '5' },
    ]
    s.currentColor = 'B'
    s.discard = [{ id: 'top', color: 'B', kind: '3' }]
    const res = applyIchiMove(s, { t: 'play', cardId: 'e8' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.phase).toBe('colorPick')
    const c = applyIchiMove(s, { t: 'chooseColor', color: 'G' })
    expect(c.ok).toBe(true)
    if (c.ok) s = c.state
    expect(s.currentColor).toBe('G')
  })
})

describe('Twin Piles', () => {
  it('deals two discard piles', () => {
    const s = createIchiMatch(['A', 'B', 'C'], [false, true, true], 'dos', 9)
    expect(s.discard.length).toBe(1)
    expect(s.discardB.length).toBe(1)
  })

  it('allows play on either pile', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'dos', 12)
    const me = s.current
    s.currentColor = 'R'
    s.currentColorB = 'Y'
    s.discard = [{ id: 'a', color: 'R', kind: '3' }]
    s.discardB = [{ id: 'b', color: 'Y', kind: '4' }]
    s.players[me]!.hand = [{ id: 'y7', color: 'Y', kind: '7' }]
    const res = applyIchiMove(s, { t: 'play', cardId: 'y7', pile: 1 })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(topCard(s, 1)?.id).toBe('y7')
  })
})

describe('Switch', () => {
  it('stacks draw twos', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'switch', 15)
    const me = s.current
    s.currentColor = 'R'
    s.discard = [{ id: 't', color: 'R', kind: '5' }]
    s.players[me]!.hand = [
      { id: 'd2', color: 'R', kind: '2' },
      { id: 'keep', color: 'G', kind: '4' },
    ]
    s.players[1 - me]!.hand = [{ id: 'd2b', color: 'Y', kind: '2' }, { id: 'x', color: 'G', kind: '3' }]
    let res = applyIchiMove(s, { t: 'play', cardId: 'd2' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.pendingDraw).toBe(2)
    expect(s.current).toBe(1 - me)
    const legal = legalPlays(s, s.current)
    expect(legal.some((c) => c.kind === '2')).toBe(true)
  })
})

describe('Palace', () => {
  it('deals hand, up, and down', () => {
    const s = createIchiMatch(['A', 'B'], [false, false], 'palace', 21)
    expect(s.players[0]!.hand).toHaveLength(3)
    expect(s.players[0]!.palaceUp).toHaveLength(3)
    expect(s.players[0]!.palaceDown).toHaveLength(3)
  })
})

describe('Ichi Flip', () => {
  it('builds a flip deck and can flip the table', () => {
    let s = createIchiMatch(['A', 'B'], [false, false], 'flip', 28)
    expect(s.flipSide).toBe('light')
    const me = s.current
    s.players[me]!.hand = [
      { id: 'fl', color: null, kind: 'flip', darkColor: null, darkKind: 'flip' },
      { id: 'n', color: 'R', kind: '3', darkColor: 'R', darkKind: '8' },
    ]
    s.currentColor = 'B'
    s.discard = [{ id: 't', color: 'B', kind: '1', darkColor: 'B', darkKind: '6' }]
    const res = applyIchiMove(s, { t: 'play', cardId: 'fl' })
    expect(res.ok).toBe(true)
    if (res.ok) s = res.state
    expect(s.flipSide).toBe('dark')
  })
})
