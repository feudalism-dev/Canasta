import { describe, expect, it } from 'vitest'
import { makeCard } from '../cards'
import { bestPartition, canKnockWithDiscard } from './partition'
import { rummyConfig } from './variants'

const gin = rummyConfig('gin', 2)

describe('gin partition', () => {
  it('finds zero deadwood for a gin hand', () => {
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
    ]
    const part = bestPartition(ginHand, gin)
    expect(part.points).toBe(0)
    expect(part.melds.length).toBeGreaterThanOrEqual(2)
  })

  it('allows knock at 10 or under after discard', () => {
    const hand11 = [
      makeCard(0, 'H', '7', 0),
      makeCard(0, 'D', '7', 0),
      makeCard(0, 'S', '7', 0),
      makeCard(0, 'C', '5', 0),
      makeCard(0, 'C', '6', 0),
      makeCard(0, 'C', '7', 0),
      makeCard(0, 'H', '2', 0),
      makeCard(0, 'D', '3', 0),
      makeCard(0, 'S', '4', 0),
      makeCard(0, 'H', '9', 0),
      makeCard(0, 'D', 'K', 0),
    ]
    const bad = canKnockWithDiscard(hand11, hand11[10]!.id, gin)
    expect(bad.ok).toBe(false)

    const knockable = [
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
    const ok = canKnockWithDiscard(knockable, knockable[10]!.id, gin)
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.partition.points).toBe(10)
      expect(ok.gin).toBe(false)
    }
  })
})
