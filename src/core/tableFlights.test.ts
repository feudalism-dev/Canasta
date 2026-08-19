import { describe, expect, it } from 'vitest'
import { idlePublicBoard, type PublicBoard } from './publicBoard'
import { planTableFlights } from './tableFlights'

function board(partial: Partial<PublicBoard>): PublicBoard {
  return {
    ...idlePublicBoard(),
    live: true,
    currentSeat: 0,
    stock: 40,
    discardCount: 4,
    top: { rank: '9', suit: 'H' },
    players: [
      { name: 'Ada', seat: 0, team: 0, handCount: 11, foot: -1 },
      { name: 'Vel', seat: 1, team: 1, handCount: 11, foot: -1 },
    ],
    teams: [
      { score: 0, hasMeld: false, redThrees: 0, melds: [] },
      { score: 0, hasMeld: false, redThrees: 0, melds: [] },
    ],
    ...partial,
  }
}

describe('table top flight plans', () => {
  it('flies a new meld from the acting seat onto that team tray', () => {
    const prev = board({ currentSeat: 0 })
    const next = board({
      currentSeat: 0,
      teams: [
        { score: 0, hasMeld: true, redThrees: 0, melds: [{ rank: 'K', count: 3, kind: 'open' }] },
        { score: 0, hasMeld: false, redThrees: 0, melds: [] },
      ],
    })
    const plans = planTableFlights(prev, next)
    expect(plans.some((p) => p.kind === 'meld' && p.team === 0 && p.count === 3 && p.seat === 0)).toBe(true)
  })

  it('flies a discard from the previous player after the turn advances', () => {
    const prev = board({ currentSeat: 1, top: { rank: '9', suit: 'H' }, discardCount: 4 })
    const next = board({ currentSeat: 2, top: { rank: 'Q', suit: 'S' }, discardCount: 5 })
    const plans = planTableFlights(prev, next)
    const d = plans.find((p) => p.kind === 'discard')
    expect(d?.seat).toBe(1)
    expect(d?.top).toEqual({ rank: 'Q', suit: 'S' })
  })

  it('flies a take-pile burst from the discard to the seat', () => {
    const prev = board({ currentSeat: 0, discardCount: 12 })
    const next = board({ currentSeat: 0, discardCount: 1, top: { rank: 'K', suit: 'D' } })
    const plans = planTableFlights(prev, next)
    expect(plans.some((p) => p.kind === 'takePile' && p.from === 'discard' && p.to === 'seat')).toBe(true)
  })

  it('skips a new deal', () => {
    const prev = board({ round: 1 })
    const next = board({ round: 2, stock: 80 })
    expect(planTableFlights(prev, next)).toEqual([])
  })
})
