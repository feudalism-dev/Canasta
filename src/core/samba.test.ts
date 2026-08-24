import { describe, expect, it } from 'vitest'
import { makeCard } from './cards'
import { createMatch } from './state'
import { getLegalMoves, tryApply, type MatchState } from './rules'
import { buildSequenceMeld } from './sequences'
import { sambaGoOutMet, teamMajorMeldCounts } from './sambaRules'
import { scoreTeamHand } from './score'
import { variantConfig } from './variants'

function forceHands(state: MatchState, hands: ReturnType<typeof makeCard>[][]): void {
  hands.forEach((h, i) => {
    state.players[i]!.hand = h
  })
}

describe('samba rules engine', () => {
  it('deals 15 cards from three decks', () => {
    const s = createMatch({ variant: 'samba', names: ['A', 'B'], humans: [true, true], seed: 9 })
    expect(s.config.deckCount).toBe(3)
    expect(s.players[0]!.hand.length).toBe(15)
    expect(s.stock.length + s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0)).toBe(162)
  })

  it('draws two cards from stock', () => {
    const s = createMatch({ variant: 'samba', names: ['A', 'B'], humans: [true, true], seed: 9 })
    const before = s.stock.length
    expect(tryApply(s, { kind: 'drawStock' }, s.currentPlayer)).toEqual({ ok: true })
    expect(s.players[s.currentPlayer]!.hand.length).toBe(17)
    expect(s.stock.length).toBe(before - 2)
  })

  it('melds a sequence and scores a samba bonus', () => {
    const cfg = variantConfig('samba', 2)
    const cards = ['6', '7', '8', '9', '10', 'J', 'Q'].map((r, i) => makeCard(0, 'H', r as '6', i))
    const { meld } = buildSequenceMeld(cards, cfg)
    expect(meld.closed).toBe(true)
    const s = createMatch({ variant: 'samba', names: ['A', 'B'], humans: [true, true], seed: 1 })
    s.teams[0]!.melds.push(meld)
    s.teams[0]!.hasInitialMeld = true
    const breakScore = scoreTeamHand(s, 0, 0)
    expect(breakScore.canastaBonus).toBeGreaterThanOrEqual(1500)
  })

  it('requires samba/canasta combo to go out', () => {
    const cfg = variantConfig('samba', 2)
    const seq = buildSequenceMeld(
      ['6', '7', '8', '9', '10', 'J', 'Q'].map((r, i) => makeCard(0, 'S', r as '6', i)),
      cfg,
    ).meld
    const counts = teamMajorMeldCounts([seq], 7)
    expect(sambaGoOutMet(counts)).toBe(false)
    const kings = Array.from({ length: 7 }, (_, i) => makeCard(1, 'H', 'K', i))
    const canasta = { rank: 'K' as const, cards: kings, closed: false }
    const both = teamMajorMeldCounts([seq, canasta], 7)
    expect(sambaGoOutMet(both)).toBe(true)
  })

  it('extends a sequence from the discard top on draw', () => {
    const s = createMatch({ variant: 'samba', names: ['A', 'B'], humans: [true, true], seed: 3 })
    const open = buildSequenceMeld(
      [makeCard(0, 'D', '6', 0), makeCard(0, 'D', '7', 0), makeCard(0, 'D', '8', 0)],
      s.config,
    ).meld
    s.teams[0]!.melds.push(open)
    s.teams[0]!.hasInitialMeld = true
    s.discard = [makeCard(0, 'D', '9', 0)]
    s.phase = 'awaitingDraw'
    s.currentPlayer = 0
    forceHands(s, [[makeCard(0, 'C', '4', 0)], s.players[1]!.hand])
    const moves = getLegalMoves(s, 0)
    expect(moves.some((m) => m.kind === 'takeSequenceTop')).toBe(true)
    expect(tryApply(s, { kind: 'takeSequenceTop', meldIndex: 0 }, 0)).toEqual({ ok: true })
    expect(s.teams[0]!.melds[0]!.cards).toHaveLength(4)
  })
})
