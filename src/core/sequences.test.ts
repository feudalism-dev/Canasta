import { describe, expect, it } from 'vitest'
import { makeCard } from './cards'
import { buildSequenceMeld, meldIsSamba, sequenceAcceptsCard, validateSequenceCards } from './sequences'
import { isGroupMeld, isSequenceMeld, meldKind } from './melds'
import { variantConfig } from './variants'

function sp(rank: Parameters<typeof makeCard>[2], copy = 0) {
  return makeCard(0, 'S', rank, copy)
}

describe('sequences', () => {
  const samba = variantConfig('samba', 4)

  it('validates a three-card run in suit', () => {
    const cards = [sp('6'), sp('7'), sp('8')]
    expect(validateSequenceCards(cards, samba)).toBeNull()
  })

  it('rejects wilds and threes in sequences', () => {
    expect(validateSequenceCards([sp('6'), sp('7'), makeCard(0, 'S', '2', 9)], samba)).toMatch(/wilds or threes/)
    expect(validateSequenceCards([sp('6'), sp('7'), makeCard(0, 'S', '3', 9)], samba)).toMatch(/wilds or threes/)
  })

  it('rejects mixed suits and non-consecutive ranks', () => {
    expect(validateSequenceCards([sp('6'), makeCard(0, 'H', '7', 0), sp('8')], samba)).toMatch(/same suit/)
    expect(validateSequenceCards([sp('6'), sp('8'), sp('9')], samba)).toMatch(/consecutive/)
  })

  it('rejects sequences when variant disallows them', () => {
    const classic = variantConfig('canasta', 4)
    expect(validateSequenceCards([sp('6'), sp('7'), sp('8')], classic)).toMatch(/not allowed/)
  })

  it('builds a sorted sequence meld and closes at seven', () => {
    const cards = [sp('10'), sp('8'), sp('9'), sp('J'), sp('Q'), sp('K'), sp('A')]
    const { meld, error } = buildSequenceMeld(cards, samba)
    expect(error).toBeNull()
    expect(meld.kind).toBe('sequence')
    expect(meld.suit).toBe('S')
    expect(meld.closed).toBe(true)
    expect(meld.cards.map((c) => c.rank)).toEqual(['8', '9', '10', 'J', 'Q', 'K', 'A'])
    expect(meldIsSamba(meld)).toBe(true)
  })

  it('detects when a card extends an open sequence', () => {
    const { meld } = buildSequenceMeld([sp('6'), sp('7'), sp('8')], samba)
    expect(sequenceAcceptsCard(meld, sp('9'), samba)).toBe(true)
    expect(sequenceAcceptsCard(meld, sp('5'), samba)).toBe(true)
    expect(sequenceAcceptsCard(meld, sp('10'), samba)).toBe(false)
  })

  it('defaults legacy melds to group kind', () => {
    const meld = { rank: '8' as const, cards: [sp('8'), sp('8', 1), sp('8', 2)], closed: false }
    expect(meldKind(meld)).toBe('group')
    expect(isGroupMeld(meld)).toBe(true)
    expect(isSequenceMeld(meld)).toBe(false)
  })
})

describe('variantConfig regression', () => {
  it('keeps Classic Canasta sequence flags off', () => {
    const cfg = variantConfig('canasta', 4)
    expect(cfg.sequencesEnabled).toBe(false)
    expect(cfg.allowMultipleGroupsSameRank).toBe(false)
    expect(cfg.stockDraw).toBe(1)
    expect(cfg.deckCount).toBe(2)
  })

  it('keeps Hand & Foot sequence flags off', () => {
    const cfg = variantConfig('handAndFoot', 4)
    expect(cfg.sequencesEnabled).toBe(false)
    expect(cfg.footSize).toBe(13)
    expect(cfg.deckCount).toBe(5)
  })

  it('configures Samba without changing Classic hand size', () => {
    const cfg = variantConfig('samba', 4)
    expect(cfg.sequencesEnabled).toBe(true)
    expect(cfg.handSize).toBe(15)
    expect(cfg.stockDraw).toBe(2)
    expect(cfg.playTo).toBe(10000)
    expect(cfg.maxWildsPerMeld).toBe(2)
  })

  it('configures Bolivia with wild books and higher play-to', () => {
    const cfg = variantConfig('bolivia', 4)
    expect(cfg.playTo).toBe(15000)
    expect(cfg.house.wildBooksAllowed).toBe(true)
    expect(cfg.blockTakePileOnWildTop).toBe(true)
    expect(cfg.goingOutRule).toBe('bolivia')
  })
})
