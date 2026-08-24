import { describe, expect, it } from 'vitest'
import { isWild, makeCard, type Card } from './cards'
import {
  DEFAULT_HOUSE,
  decodeHouseCompact,
  encodeHouseCompact,
  houseForVariant,
  isBetaVariant,
  isHandAndFoot,
  isSambaFamily,
  PAGAT_HOUSE,
} from './houseRules'
import { variantOptions } from './variants'
import { peekDiscard, tryApply, type MatchState } from './rules'
import { createMatch } from './state'

describe('houseRules compact', () => {
  it('round-trips Pagat defaults', () => {
    const packed = encodeHouseCompact(PAGAT_HOUSE)
    expect(packed.startsWith('v1|')).toBe(true)
    expect(decodeHouseCompact(packed)).toEqual(PAGAT_HOUSE)
  })

  it('fills missing fields from defaults', () => {
    expect(decodeHouseCompact('nope')).toBeNull()
    const h = houseForVariant('handAndFootHouse', { takeDiscardTopSeven: true })
    expect(h.takeDiscardTopSeven).toBe(true)
    expect(h.autoplayRedThreesOnDraw).toBe(DEFAULT_HOUSE.autoplayRedThreesOnDraw)
  })

  it('Pagat ignores house overrides', () => {
    const h = houseForVariant('handAndFoot', { takeDiscardTopSeven: true, redThreeScorePoints: 50 })
    expect(h).toEqual(PAGAT_HOUSE)
  })

  it('treats both Hand and Foot variants as H&F', () => {
    expect(isHandAndFoot('handAndFoot')).toBe(true)
    expect(isHandAndFoot('handAndFootHouse')).toBe(true)
    expect(isHandAndFoot('canasta')).toBe(false)
    expect(isHandAndFoot('samba')).toBe(false)
  })

  it('marks Samba and Bolivia as beta', () => {
    expect(isBetaVariant('samba')).toBe(true)
    expect(isBetaVariant('bolivia')).toBe(true)
    expect(isBetaVariant('canasta')).toBe(false)
    expect(isSambaFamily('samba')).toBe(true)
    const opts = variantOptions()
    expect(opts.some((o) => o.value === 'samba' && o.beta)).toBe(true)
    expect(opts.some((o) => o.value === 'bolivia' && o.beta)).toBe(true)
    expect(opts.find((o) => o.value === 'canasta')?.beta).toBe(false)
  })
})

function fillLow(n: number, seed = 40): Card[] {
  const suits = ['H', 'D', 'S', 'C'] as const
  const ranks = ['4', '5', '6', '7', '8'] as const
  const out: Card[] = []
  for (let i = 0; i < n; i++) {
    out.push(makeCard(seed + i, suits[i % 4]!, ranks[i % ranks.length]!, 0))
  }
  return out
}

function forceHands(state: MatchState, hands: Card[][], discard: Card[], stock: Card[]): void {
  hands.forEach((h, i) => {
    state.players[i]!.hand = h
  })
  state.discard = discard
  state.stock = stock
}

describe('top-7 discard pickup', () => {
  it('leaves the rest of the pile when takeDiscardTopSeven is on', () => {
    const s = createMatch({
      variant: 'handAndFootHouse',
      names: ['A', 'B'],
      humans: [true, true],
      seed: 4,
      house: { ...DEFAULT_HOUSE, takeDiscardTopSeven: true, requireNaturalPairToTakePile: true },
    })
    const top = makeCard(5, 'H', 'J', 0)
    const buried = Array.from({ length: 10 }, (_, i) => makeCard(20 + i, 'S', '4', 0))
    const claim = [makeCard(1, 'H', 'J', 1), makeCard(1, 'D', 'J', 0)]
    forceHands(
      s,
      [claim.concat(fillLow(11, 100)), fillLow(13, 200)],
      [...buried, top],
      fillLow(40, 80).filter((c) => !isWild(c)),
    )
    s.discardFrozen = true
    s.teams[0]!.hasInitialMeld = true
    s.phase = 'awaitingDraw'
    s.currentPlayer = 0
    const before = s.discard.length
    expect(before).toBeGreaterThan(7)
    const res = tryApply(s, { kind: 'takePile', cardIds: claim.map((c) => c.id) }, 0)
    expect(res).toEqual({ ok: true })
    expect(s.discard.length).toBe(before - 7)
    expect(peekDiscard(s)?.rank).toBe('4')
  })
})
