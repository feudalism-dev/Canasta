import { describe, expect, it } from 'vitest'
import {
  scoreCategory,
  scoreWithJoker,
  upperBonus,
  upperSubtotal,
} from './score'
import { applyYotsyMove } from './rules'
import { createYotsyMatch } from './state'
import { freshDice, hasTwoPairSameColor, isFlush, isYahtzee, rollDice, valuesOf } from './dice'
import { turnsNeeded } from './categories'

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

describe('kismet scoring', () => {
  it('uses colored flush and tiered upper bonus', () => {
    expect(isFlush([1, 1, 6, 6, 6])).toBe(true) // all black
    expect(isFlush([2, 2, 5, 5, 5])).toBe(true) // all red
    expect(isFlush([1, 2, 3, 4, 5])).toBe(false)
    expect(hasTwoPairSameColor([1, 1, 6, 6, 3])).toBe(true) // black pairs
    expect(hasTwoPairSameColor([1, 1, 2, 2, 3])).toBe(false) // different colors
    expect(scoreCategory([1, 1, 6, 6, 6], 'flush', 'kismet')).toBe(35)
    expect(scoreCategory([2, 2, 2, 5, 5], 'fullHouse', 'kismet')).toBe(31)
    expect(scoreCategory([2, 2, 2, 5, 5], 'fullHouseColor', 'kismet')).toBe(36)
    expect(scoreCategory([4, 4, 4, 4, 4], 'kismet', 'kismet')).toBe(70)

    const mid = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 26 }
    expect(upperSubtotal(mid)).toBe(71)
    expect(upperBonus(mid, 'kismet')).toBe(55)
    const top = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 20, sixes: 28 }
    expect(upperSubtotal(top)).toBe(78)
    expect(upperBonus(top, 'kismet')).toBe(75)
  })

  it('needs 15 turns', () => {
    expect(turnsNeeded('kismet')).toBe(15)
    expect(turnsNeeded('classic')).toBe(13)
  })
})

describe('yacht scoring', () => {
  it('uses 1938 boxes and no upper bonus', () => {
    expect(turnsNeeded('yacht')).toBe(12)
    expect(upperBonus({ ones: 5, twos: 10, threes: 15, fours: 20, fives: 25, sixes: 30 }, 'yacht')).toBe(0)
    expect(scoreCategory([6, 6, 6, 5, 5], 'fullHouse', 'yacht')).toBe(28)
    expect(scoreCategory([6, 6, 6, 6, 6], 'fullHouse', 'yacht')).toBe(0)
    expect(scoreCategory([3, 3, 3, 3, 6], 'fourKind', 'yacht')).toBe(12)
    expect(scoreCategory([1, 2, 3, 4, 5], 'smallStraight', 'yacht')).toBe(30)
    expect(scoreCategory([1, 2, 3, 4, 6], 'smallStraight', 'yacht')).toBe(0)
    expect(scoreCategory([2, 3, 4, 5, 6], 'largeStraight', 'yacht')).toBe(30)
    expect(scoreCategory([6, 6, 6, 6, 6], 'yahtzee', 'yacht')).toBe(50)
  })
})

describe('generala scoring', () => {
  it('applies fixed scores and servido bonus', () => {
    expect(turnsNeeded('generala')).toBe(11)
    expect(scoreCategory([1, 2, 3, 4, 5], 'straight', 'generala')).toBe(20)
    expect(scoreCategory([1, 2, 3, 4, 5], 'straight', 'generala', { served: true })).toBe(25)
    expect(scoreCategory([2, 2, 2, 5, 5], 'fullHouse', 'generala')).toBe(30)
    expect(scoreCategory([2, 2, 2, 2, 1], 'fourKind', 'generala', { served: true })).toBe(45)
    expect(scoreCategory([4, 4, 4, 4, 4], 'generala', 'generala')).toBe(60)
    expect(scoreWithJoker([4, 4, 4, 4, 4], 'doubleGenerala', {}, 'generala')).toBe(0)
    expect(scoreWithJoker([4, 4, 4, 4, 4], 'doubleGenerala', { generala: 60 }, 'generala')).toBe(100)
  })

  it('generala servida wins on first-roll fiveoak', () => {
    let seed = -1
    for (let s = 0; s < 50000; s++) {
      if (isYahtzee(valuesOf(rollDice(freshDice(), s)))) {
        seed = s
        break
      }
    }
    expect(seed).toBeGreaterThanOrEqual(0)
    const state = createYotsyMatch(['You', 'Bot'], [false, true], 'generala')
    const roll = applyYotsyMove(state, { t: 'roll', seed })
    expect(roll.ok).toBe(true)
    if (!roll.ok) return
    expect(roll.state.phase).toBe('matchEnd')
    expect(roll.state.winnerId).toBe(state.players[0]!.id)
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

  it('supports four players and kismet boxes', () => {
    const state = createYotsyMatch(
      ['A', 'B', 'C', 'D'],
      [false, true, true, true],
      'kismet',
    )
    expect(state.players).toHaveLength(4)
    expect(state.config.variant).toBe('kismet')
    const roll = applyYotsyMove(state, { t: 'roll' })
    expect(roll.ok).toBe(true)
    if (!roll.ok) return
    const scored = applyYotsyMove(roll.state, { t: 'score', category: 'yarborough' })
    expect(scored.ok).toBe(true)
    if (!scored.ok) return
    expect(scored.state.players[0]!.card.yarborough).toBeDefined()
    expect(scored.state.current).toBe(1)
  })
})
