import { describe, expect, it } from 'vitest'
import { scoreCategory, scoreWithJoker, upperBonus, upperSubtotal } from './score'
import { applyYotsyMove } from './rules'
import { createYotsyMatch } from './state'

describe('yotsy scoring', () => {
  it('scores upper and yahtzee', () => {
    expect(scoreCategory([1, 1, 1, 2, 3], 'ones')).toBe(3)
    expect(scoreCategory([6, 6, 6, 6, 6], 'yahtzee')).toBe(50)
    expect(scoreCategory([6, 6, 6, 6, 6], 'sixes')).toBe(30)
    expect(scoreCategory([2, 3, 4, 5, 6], 'largeStraight')).toBe(40)
    expect(scoreCategory([1, 2, 3, 4, 6], 'smallStraight')).toBe(30)
    expect(scoreCategory([2, 2, 3, 3, 3], 'fullHouse')).toBe(25)
  })

  it('applies upper bonus at 63', () => {
    const card = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 }
    expect(upperSubtotal(card)).toBe(63)
    expect(upperBonus(card)).toBe(35)
  })

  it('jokers lower boxes after yahtzee filled', () => {
    const vals = [4, 4, 4, 4, 4]
    const card = { yahtzee: 50 }
    expect(scoreWithJoker(vals, 'fullHouse', card)).toBe(25)
    expect(scoreWithJoker(vals, 'largeStraight', card)).toBe(40)
    expect(scoreWithJoker(vals, 'fours', card)).toBe(20)
  })
})

describe('yotsy rules', () => {
  it('requires roll before score and completes a turn', () => {
    let state = createYotsyMatch(['You', 'Bot'], [false, true], 'classic')
    expect(applyYotsyMove(state, { t: 'score', category: 'chance' }).ok).toBe(false)

    const roll = applyYotsyMove(state, { t: 'roll' })
    expect(roll.ok).toBe(true)
    if (!roll.ok) return
    state = roll.state
    expect(state.hasRolled).toBe(true)
    expect(state.rollsLeft).toBe(2)

    const scored = applyYotsyMove(state, { t: 'score', category: 'chance' })
    expect(scored.ok).toBe(true)
    if (!scored.ok) return
    expect(scored.state.players[0]!.turnsDone).toBe(1)
    expect(scored.state.players[0]!.card.chance).toBeDefined()
    expect(scored.state.current).toBe(1)
  })
})
