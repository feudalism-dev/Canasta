import { describe, expect, it } from 'vitest'
import { makeCard } from '../cards'
import { classifyMeld, isRun, isSet } from './melds'

describe('rummy melds', () => {
  it('accepts a three of a kind', () => {
    const cards = [makeCard(0, 'H', '7', 0), makeCard(0, 'D', '7', 0), makeCard(0, 'S', '7', 0)]
    expect(isSet(cards)).toBe(true)
    expect(classifyMeld(cards)).toBe('set')
  })

  it('accepts a suited run', () => {
    const cards = [makeCard(0, 'H', '5', 0), makeCard(0, 'H', '6', 0), makeCard(0, 'H', '7', 0)]
    expect(isRun(cards)).toBe(true)
    expect(classifyMeld(cards)).toBe('run')
  })

  it('allows ace-low and ace-high runs but not wrap', () => {
    const low = [makeCard(0, 'S', 'A', 0), makeCard(0, 'S', '2', 0), makeCard(0, 'S', '3', 0)]
    const high = [makeCard(0, 'S', 'Q', 0), makeCard(0, 'S', 'K', 0), makeCard(0, 'S', 'A', 0)]
    const wrap = [makeCard(0, 'S', 'K', 0), makeCard(0, 'S', 'A', 0), makeCard(0, 'S', '2', 0)]
    expect(isRun(low)).toBe(true)
    expect(isRun(high)).toBe(true)
    expect(isRun(wrap)).toBe(false)
  })
})
