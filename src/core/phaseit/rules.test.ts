import { describe, expect, it } from 'vitest'
import { isValidColor, isValidRun, isValidSet, findPhaseGroups, matchPhaseGroups } from './melds'
import { CLASSIC_PHASES } from './phases'
import { applyPhaseItMove } from './rules'
import { createPhaseItMatch, topDiscard } from './state'
import type { PhaseItCard } from './types'

function c(id: string, color: PhaseItCard['color'], kind: PhaseItCard['kind']): PhaseItCard {
  return { id, color, kind }
}

describe('phaseit melds', () => {
  it('validates sets with wilds', () => {
    expect(isValidSet([c('a', 'R', 5), c('b', 'Y', 5), c('c', null, 'wild')], 3)).toBe(true)
    expect(isValidSet([c('a', 'R', 5), c('b', 'Y', 6), c('c', 'G', 5)], 3)).toBe(false)
    expect(isValidSet([c('a', null, 'skip'), c('b', 'R', 5), c('c', 'Y', 5)], 3)).toBe(false)
  })

  it('validates runs with wilds filling gaps', () => {
    expect(
      isValidRun(
        [c('a', 'R', 3), c('b', 'Y', 4), c('c', 'G', 5), c('d', 'B', 6)],
        4,
      ),
    ).toBe(true)
    expect(
      isValidRun([c('a', 'R', 3), c('b', null, 'wild'), c('c', 'G', 5), c('d', 'B', 6)], 4),
    ).toBe(true)
    expect(isValidRun([c('a', 'R', 3), c('b', 'Y', 4), c('c', 'G', 7)], 3)).toBe(false)
  })

  it('validates color blocks', () => {
    expect(
      isValidColor(
        [
          c('a', 'R', 1),
          c('b', 'R', 5),
          c('c', 'R', 9),
          c('d', 'R', 12),
          c('e', null, 'wild'),
          c('f', 'R', 3),
          c('g', 'R', 7),
        ],
        7,
      ),
    ).toBe(true)
  })

  it('finds phase 1 groups in a stuffed hand', () => {
    const hand = [
      c('a', 'R', 2),
      c('b', 'Y', 2),
      c('c', 'G', 2),
      c('d', 'R', 8),
      c('e', 'Y', 8),
      c('f', 'B', 8),
      c('g', 'R', 1),
      c('h', 'Y', 3),
      c('i', 'G', 4),
      c('j', 'B', 5),
    ]
    const groups = findPhaseGroups(hand, CLASSIC_PHASES[0]!.parts)
    expect(groups).not.toBeNull()
    const cards = groups!.map((ids) => ids.map((id) => hand.find((x) => x.id === id)!))
    expect(matchPhaseGroups(cards, CLASSIC_PHASES[0]!.parts)).not.toBeNull()
  })
})

describe('phaseit rules', () => {
  it('deals 10 cards and requires draw before discard', () => {
    const state = createPhaseItMatch(['You', 'Bot'], [false, true], 'classic', 42)
    expect(state.players[0]!.hand).toHaveLength(10)
    expect(state.players[1]!.hand).toHaveLength(10)
    expect(state.stock.length).toBeGreaterThan(0)
    expect(topDiscard(state)).not.toBeNull()

    const bad = applyPhaseItMove(state, { t: 'discard', cardId: state.players[0]!.hand[0]!.id })
    expect(bad.ok).toBe(false)

    const draw = applyPhaseItMove(state, { t: 'drawStock' })
    expect(draw.ok).toBe(true)
    if (!draw.ok) return
    expect(draw.state.hasDrawn).toBe(true)
    expect(draw.state.players[0]!.hand).toHaveLength(11)
  })

  it('skips next player on Skip discard', () => {
    let state = createPhaseItMatch(['A', 'B', 'C'], [false, true, true], 'classic', 7)
    // Force a skip into A's hand and draw flag
    const skip = c('skip1', null, 'skip')
    state = {
      ...state,
      hasDrawn: true,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, hand: [...p.hand, skip] } : p,
      ),
    }
    const res = applyPhaseItMove(state, { t: 'discard', cardId: 'skip1' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // A=0, skip B=1 → C=2
    expect(res.state.current).toBe(2)
  })
})
