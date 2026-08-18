import { describe, expect, it } from 'vitest'
import { buildDeck, isRedThree, isWild, makeCard, type Card } from './cards'
import { createMatch } from './state'
import { claimCardsForPile, getLegalMoves, initialMeldMinimum, peekDiscard, tryApply, type MatchState } from './rules'
import { teamCanastaCounts } from './melds'
import { eventsForMove } from './displayEvents'
import { DEFAULT_HOUSE } from './types'

function kings(n: number, start = 0): Card[] {
  const suits = ['H', 'D', 'S', 'C'] as const
  const out: Card[] = []
  for (let i = 0; i < n; i++) {
    out.push(makeCard(start + i, suits[i % 4]!, 'K', 0))
  }
  return out
}

function aces(n: number, start = 0): Card[] {
  const suits = ['H', 'D', 'S', 'C'] as const
  const out: Card[] = []
  for (let i = 0; i < n; i++) {
    out.push(makeCard(10 + start + i, suits[i % 4]!, 'A', 0))
  }
  return out
}

function wilds(n: number): Card[] {
  const out: Card[] = []
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) out.push(makeCard(20 + i, 'H', '2', 0))
    else out.push(makeCard(20 + i, 'J', 'JOKER', i))
  }
  return out
}

function fillLow(n: number, seed = 40): Card[] {
  const ranks = ['4', '5', '6', '7', '8', '9'] as const
  const suits = ['H', 'D', 'S', 'C'] as const
  const out: Card[] = []
  for (let i = 0; i < n; i++) {
    out.push(makeCard(seed + i, suits[i % 4]!, ranks[i % ranks.length]!, 0))
  }
  return out
}

function forceHands(state: MatchState, hands: Card[][], discard: Card[], stock: Card[]): void {
  hands.forEach((h, i) => {
    state.players[i]!.hand = h
    state.players[i]!.foot = []
    state.players[i]!.footPickedUp = state.config.footSize === 0
  })
  state.discard = discard
  state.stock = stock
  state.phase = 'awaitingDraw'
  state.currentPlayer = 0
}

describe('deal', () => {
  it('deals 15 each in 2-player Canasta from 108 cards', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 3 })
    expect(s.players).toHaveLength(2)
    expect(s.players[0]!.hand.length).toBeGreaterThanOrEqual(15)
    expect(s.config.deckCount).toBe(2)
    expect(buildDeck(2)).toHaveLength(108)
    expect(s.players[0]!.team).toBe(0)
    expect(s.players[1]!.team).toBe(1)
  })

  it('deals 13+13 and partners across in 4-player Hand and Foot', () => {
    const s = createMatch({
      variant: 'handAndFoot',
      names: ['A', 'B', 'C', 'D'],
      humans: [true, false, false, false],
      seed: 9,
    })
    expect(s.config.deckCount).toBe(5)
    expect(s.players[0]!.team).toBe(0)
    expect(s.players[2]!.team).toBe(0)
    expect(s.players[1]!.team).toBe(1)
    expect(s.players[0]!.hand.length + s.teams[0]!.redThrees.length).toBeGreaterThanOrEqual(11)
    expect(s.players[0]!.foot.length).toBeGreaterThanOrEqual(10)
    expect(s.config.stockDraw).toBe(2)
  })

  it('lays red threes out of the hand', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 1 })
    for (const p of s.players) {
      expect(p.hand.some(isRedThree)).toBe(false)
    }
  })
})

describe('initial meld', () => {
  it('uses Canasta score thresholds', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 1 })
    expect(initialMeldMinimum(s.config, 0, 1)).toBe(50)
    expect(initialMeldMinimum(s.config, 1500, 1)).toBe(90)
    expect(initialMeldMinimum(s.config, 3000, 1)).toBe(120)
    expect(initialMeldMinimum(s.config, -10, 1)).toBe(15)
  })

  it('uses Hand and Foot round thresholds', () => {
    const s = createMatch({ variant: 'handAndFoot', names: ['A', 'B'], humans: [true, true], seed: 1 })
    expect(initialMeldMinimum(s.config, 0, 1)).toBe(50)
    expect(initialMeldMinimum(s.config, 0, 2)).toBe(90)
    expect(initialMeldMinimum(s.config, 0, 4)).toBe(150)
  })

  it('rejects a meld under the minimum', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    forceHands(s, [kings(3).concat(fillLow(12)), fillLow(15)], [makeCard(99, 'H', '4', 0)], fillLow(20, 200))
    tryApply(s, { kind: 'drawStock' }, 0)
    const ids = s.players[0]!.hand.filter((c) => c.rank === 'K').slice(0, 3).map((c) => c.id)
    const res = tryApply(s, { kind: 'meld', cardIds: ids }, 0)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/Initial meld needs 50/)
  })

  it('accepts aces that meet 50', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    forceHands(s, [aces(3).concat(fillLow(12)), fillLow(15)], [makeCard(99, 'H', '4', 0)], fillLow(20, 200))
    tryApply(s, { kind: 'drawStock' }, 0)
    const ids = s.players[0]!.hand.filter((c) => c.rank === 'A').slice(0, 3).map((c) => c.id)
    const res = tryApply(s, { kind: 'meld', cardIds: ids }, 0)
    expect(res).toEqual({ ok: true })
    expect(s.teams[0]!.hasInitialMeld).toBe(true)
  })
})

describe('discard pile', () => {
  it('blocks taking a black three or wild', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    forceHands(s, [kings(5).concat(fillLow(10)), fillLow(15)], [makeCard(1, 'S', '3', 0)], fillLow(20, 80))
    expect(claimCardsForPile(s, 0)).toBeNull()
    s.discard = [makeCard(2, 'H', '2', 0)]
    expect(claimCardsForPile(s, 0)).toBeNull()
  })

  it('requires two naturals when frozen', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    const a = aces(2)
    forceHands(s, [a.concat(fillLow(13)), fillLow(15)], [makeCard(5, 'H', 'A', 0), makeCard(6, 'H', '2', 0)], fillLow(20, 80))
    s.discardFrozen = true
    s.discard = [makeCard(6, 'H', '2', 0), makeCard(5, 'H', 'A', 0)]
    const claim = claimCardsForPile(s, 0)
    expect(claim).toHaveLength(2)
    const res = tryApply(s, { kind: 'takePile', cardIds: claim! }, 0)
    expect(res).toEqual({ ok: true })
    expect(s.phase).toBe('awaitingPlay')
    expect(s.discardFrozen).toBe(false)
  })

  it('blocks a frozen queen pile when two queens are short of the initial meld', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    const q = [
      makeCard(1, 'H', 'Q', 0),
      makeCard(1, 'D', 'Q', 0),
    ]
    forceHands(
      s,
      [q.concat(fillLow(13, 400)), fillLow(15, 500)],
      [makeCard(2, 'S', 'Q', 0)],
      fillLow(20, 80),
    )
    s.discardFrozen = true
    s.discard = [makeCard(9, 'H', '2', 0), makeCard(2, 'S', 'Q', 0)]
    expect(claimCardsForPile(s, 0)).toHaveLength(2)
    const onlyQueens = tryApply(s, { kind: 'takePile', cardIds: claimCardsForPile(s, 0)! }, 0)
    expect(onlyQueens.ok).toBe(false)
    if (!onlyQueens.ok) expect(onlyQueens.error).toMatch(/Initial meld needs 50/)
  })

  it('takes a frozen queen pile when extra aces finish the initial meld', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    const q = [makeCard(1, 'H', 'Q', 0), makeCard(1, 'D', 'Q', 0)]
    forceHands(
      s,
      [q.concat(aces(3)).concat(fillLow(10, 400)), fillLow(15, 500)],
      [makeCard(2, 'S', 'Q', 0)],
      fillLow(20, 80),
    )
    s.discardFrozen = true
    s.discard = [makeCard(9, 'H', '2', 0), makeCard(2, 'S', 'Q', 0)]
    const moves = getLegalMoves(s, 0)
    const take = moves.find((m) => m.kind === 'takePile')
    expect(take).toBeTruthy()
    const res = tryApply(s, take!, 0)
    expect(res).toEqual({ ok: true })
    expect(s.teams[0]!.hasInitialMeld).toBe(true)
    expect(s.teams[0]!.melds.some((m) => m.rank === 'Q')).toBe(true)
    expect(s.teams[0]!.melds.some((m) => m.rank === 'A')).toBe(true)
  })

  it('freezes when a wild is discarded', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    const w = wilds(1)
    forceHands(s, [aces(3).concat(w).concat(fillLow(11)), fillLow(15)], [makeCard(99, 'H', '4', 0)], fillLow(30, 200))
    tryApply(s, { kind: 'drawStock' }, 0)
    tryApply(s, { kind: 'meld', cardIds: s.players[0]!.hand.filter((c) => c.rank === 'A').slice(0, 3).map((c) => c.id) }, 0)
    const wild = s.players[0]!.hand.find(isWild)!
    const res = tryApply(s, { kind: 'discard', cardId: wild.id }, 0)
    expect(res).toEqual({ ok: true })
    expect(s.discardFrozen).toBe(true)
    expect(s.currentPlayer).toBe(1)
  })
})

describe('Hand and Foot', () => {
  it('draws two from stock', () => {
    const s = createMatch({ variant: 'handAndFoot', names: ['A', 'B'], humans: [true, true], seed: 4 })
    const before = s.players[0]!.hand.length
    const stock = s.stock.length
    tryApply(s, { kind: 'drawStock' }, 0)
    expect(s.players[0]!.hand.length).toBeGreaterThanOrEqual(before + 1)
    expect(s.stock.length).toBeLessThanOrEqual(stock - 2)
    expect(s.phase).toBe('awaitingPlay')
  })

  it('picks up the Foot after discarding the last Hand card', () => {
    const s = createMatch({ variant: 'handAndFoot', names: ['A', 'B'], humans: [true, true], seed: 4 })
    const foot = fillLow(13, 300)
    forceHands(s, [fillLow(1, 1), fillLow(13, 20)], [makeCard(99, 'H', '9', 0)], fillLow(40, 80))
    s.players[0]!.foot = foot
    s.players[0]!.footPickedUp = false
    s.teams[0]!.hasInitialMeld = true
    s.phase = 'awaitingPlay'
    const last = s.players[0]!.hand[0]!
    tryApply(s, { kind: 'discard', cardId: last.id }, 0)
    expect(s.players[0]!.footPickedUp).toBe(true)
    expect(s.players[0]!.hand.length).toBe(foot.length)
    expect(s.phase).toBe('awaitingDraw')
    expect(s.currentPlayer).toBe(1)
  })

  it('closes a dirty book at seven with four naturals', () => {
    const s = createMatch({ variant: 'handAndFoot', names: ['A', 'B'], humans: [true, true], seed: 4 })
    const set = kings(4).concat(wilds(3)).concat(fillLow(6, 70))
    forceHands(s, [set, fillLow(13, 20)], [makeCard(99, 'H', '9', 0)], fillLow(40, 80))
    s.teams[0]!.hasInitialMeld = true
    s.phase = 'awaitingPlay'
    const ids = s.players[0]!.hand.filter((c) => c.rank === 'K' || isWild(c)).slice(0, 7).map((c) => c.id)
    const res = tryApply(s, { kind: 'meld', cardIds: ids }, 0)
    expect(res).toEqual({ ok: true })
    expect(s.teams[0]!.melds[0]!.closed).toBe(true)
    expect(teamCanastaCounts(s.teams[0]!.melds, 7).dirty).toBe(1)
  })

  it('honors 2 clean + 2 dirty going-out toggle', () => {
    const s = createMatch({
      variant: 'handAndFoot',
      names: ['A', 'B'],
      humans: [true, true],
      seed: 4,
      house: { ...DEFAULT_HOUSE, goingOutClean: 2, goingOutDirty: 2, partnerConsent: false },
    })
    expect(s.config.house.goingOutClean).toBe(2)
    expect(s.config.house.goingOutDirty).toBe(2)
  })
})

describe('going out and scoring', () => {
  it('cannot meld down to one card without a canasta', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    forceHands(s, [aces(3).concat(fillLow(1, 50)), fillLow(15)], [makeCard(99, 'H', '4', 0)], fillLow(20, 200))
    s.teams[0]!.hasInitialMeld = true
    s.phase = 'awaitingPlay'
    const res = tryApply(s, { kind: 'meld', cardIds: s.players[0]!.hand.filter((c) => c.rank === 'A').map((c) => c.id) }, 0)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/Keep enough cards/)
  })

  it('cannot discard the last card without a canasta', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    forceHands(s, [[makeCard(1, 'H', '4', 0)], fillLow(15)], [makeCard(99, 'H', '9', 0)], fillLow(20, 200))
    s.teams[0]!.hasInitialMeld = true
    s.phase = 'awaitingPlay'
    const res = tryApply(s, { kind: 'discard', cardId: s.players[0]!.hand[0]!.id }, 0)
    expect(res.ok).toBe(false)
  })

  it('ends the match at 5000', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    s.teams[0]!.score = 4900
    s.teams[0]!.hasInitialMeld = true
    s.teams[0]!.melds = [{ rank: 'K', cards: kings(7), closed: false }]
    forceHands(s, [[makeCard(1, 'H', '4', 0)], fillLow(15)], [makeCard(99, 'H', '9', 0)], [])
    s.phase = 'awaitingPlay'
    s.players[0]!.footPickedUp = true
    tryApply(s, { kind: 'discard', cardId: s.players[0]!.hand[0]!.id }, 0)
    expect(s.phase).toBe('matchEnd')
    expect(s.winnerTeam).toBe(0)
  })
})

describe('legal moves', () => {
  it('always offers a discard after drawing a normal hand', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    forceHands(s, [aces(3).concat(fillLow(12)), fillLow(15)], [makeCard(99, 'H', '4', 0)], fillLow(20, 200))
    tryApply(s, { kind: 'drawStock' }, 0)
    const moves = getLegalMoves(s, 0)
    expect(moves.some((m) => m.kind === 'discard')).toBe(true)
  })
})

describe('display events', () => {
  it('emits DRAW then DISCARD pipes', () => {
    const prev = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    forceHands(prev, [aces(3).concat(fillLow(12)), fillLow(15)], [makeCard(99, 'H', '4', 0)], fillLow(20, 200))
    const next = structuredClone(prev)
    tryApply(next, { kind: 'drawStock' }, 0)
    const ev = eventsForMove(prev, next, { kind: 'drawStock' }, 0)
    expect(ev.some((e) => e.startsWith('DRAW|'))).toBe(true)
  })
})

describe('upcard freeze', () => {
  it('keeps a wild upcard as frozen until a natural covers it', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 11 })
    const top = peekDiscard(s)
    expect(top).toBeTruthy()
    if (top && (isWild(top) || isRedThree(top))) expect(s.discardFrozen).toBe(true)
  })
})
