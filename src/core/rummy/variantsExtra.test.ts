import { describe, expect, it } from 'vitest'
import { makeCard } from '../cards'
import { classifyMeld } from './melds'
import { applyRummyMove } from './rules'
import { createRummyMatch } from './state'
import { oklahomaKnockMax, oklahomaScoreMult, rummyConfig } from './variants'

describe('Oklahoma Gin', () => {
  it('maps upcard to knock max and spade multiplier', () => {
    expect(oklahomaKnockMax(makeCard(0, 'H', 'A', 0))).toBe(0)
    expect(oklahomaKnockMax(makeCard(0, 'H', '5', 0))).toBe(5)
    expect(oklahomaKnockMax(makeCard(0, 'H', 'K', 0))).toBe(10)
    expect(oklahomaScoreMult(makeCard(0, 'S', '7', 0))).toBe(2)
    expect(oklahomaScoreMult(makeCard(0, 'H', '7', 0))).toBe(1)
  })

  it('deals ten cards, playTo 150, and sets knock from upcard', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'oklahoma', 42)
    expect(state.players).toHaveLength(2)
    expect(state.players[0]!.hand).toHaveLength(10)
    expect(state.config.playTo).toBe(150)
    expect(state.config.oklahoma).toBe(true)
    expect(state.discard).toHaveLength(1)
    const up = state.discard[0]!
    expect(state.config.knockMax).toBe(oklahomaKnockMax(up))
    expect(state.scoreMultThisHand).toBe(oklahomaScoreMult(up))
  })
})

describe('Rummy 500', () => {
  it('deals 13 to two players with meld scoring to 500', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'rummy500', 7)
    expect(state.players[0]!.hand).toHaveLength(13)
    expect(state.config.playTo).toBe(500)
    expect(state.config.deepDiscard).toBe(true)
    expect(state.config.meldScoring).toBe(true)
    expect(state.config.aceDeadwood).toBe(15)
    expect(state.config.scoreAscending).toBe(false)
  })

  it('deep discard take requires using the buried card', () => {
    let state = createRummyMatch(['You', 'Bot'], [false, true], 'rummy500', 11)
    const buried = makeCard(0, 'H', '8', 0)
    const mid = makeCard(0, 'D', '3', 0)
    const top = makeCard(0, 'S', '2', 0)
    state = structuredClone(state)
    state.discard = [buried, mid, top]
    state.phase = 'draw'
    state.drew = false
    state.current = 0

    const take = applyRummyMove(state, { t: 'takeDiscardDeep', fromIndex: 0 })
    expect(take.ok).toBe(true)
    if (!take.ok) return
    expect(take.state.mustUseCardId).toBe(buried.id)
    expect(take.state.players[0]!.hand.some((c) => c.id === buried.id)).toBe(true)
    expect(take.state.discard).toHaveLength(0)

    const discardOther = applyRummyMove(take.state, {
      t: 'discard',
      cardId: take.state.players[0]!.hand.find((c) => c.id !== buried.id)!.id,
    })
    expect(discardOther.ok).toBe(false)
  })

  it('scores melds minus hand when a player goes out', () => {
    let state = createRummyMatch(['You', 'Bot'], [false, true], 'rummy500', 3)
    state = structuredClone(state)
    const you = state.players[0]!
    const bot = state.players[1]!
    you.hand = [makeCard(0, 'H', '9', 0)]
    you.melds = [
      {
        id: 'm0-0',
        kind: 'set',
        cards: [makeCard(0, 'H', '7', 0), makeCard(0, 'D', '7', 0), makeCard(0, 'S', '7', 0)],
      },
    ]
    you.scoredLayoffs = []
    bot.hand = [makeCard(0, 'C', '5', 0), makeCard(0, 'C', '6', 0)]
    bot.melds = []
    bot.scoredLayoffs = []
    state.drew = true
    state.phase = 'meld'
    state.current = 0

    const res = applyRummyMove(state, { t: 'discard', cardId: you.hand[0]!.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.phase).toBe('roundEnd')
    // You: 7+7+7=21 meld − 0 hand = +21; bot: 0 meld − (5+6) = −11
    expect(res.state.players[0]!.score).toBe(21)
    expect(res.state.players[1]!.score).toBe(-11)
  })
})

describe('Kalooki (open)', () => {
  it('uses two decks with jokers and nine hands', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'kalooki', 2)
    expect(state.players[0]!.hand).toHaveLength(13)
    expect(state.config.deckCount).toBe(2)
    expect(state.config.jokers).toBe(true)
    expect(state.config.handsPerMatch).toBe(9)
    expect(state.config.scoreAscending).toBe(true)
    expect(state.config.allowJokersInMelds).toBe(true)
  })

  it('allows jokers in sets and rejects discarding a joker', () => {
    const cfg = rummyConfig('kalooki', 2)
    const set = [
      makeCard(0, 'H', '7', 0),
      makeCard(0, 'D', '7', 0),
      makeCard(0, 'J', 'JOKER', 0),
    ]
    expect(classifyMeld(set, cfg)).toBe('set')

    let state = createRummyMatch(['You', 'Bot'], [false, true], 'kalooki', 4)
    state = structuredClone(state)
    const joker = makeCard(0, 'J', 'JOKER', 0)
    state.players[0]!.hand = [joker, makeCard(0, 'H', '3', 0)]
    state.drew = true
    state.phase = 'meld'
    state.current = 0
    const bad = applyRummyMove(state, { t: 'discard', cardId: joker.id })
    expect(bad.ok).toBe(false)
  })
})
