import { describe, expect, it } from 'vitest'
import { chairsFromOccupants, fourHandRoster, matchupSentence, partnerSeatOf } from './tableSeating'
import { teamOfSeat } from './variants'

describe('table seating teams', () => {
  it('partners opposites and fills empty chairs with computers', () => {
    expect(partnerSeatOf(0)).toBe(2)
    expect(partnerSeatOf(1)).toBe(3)
    expect(teamOfSeat(0)).toBe(teamOfSeat(2))
    expect(teamOfSeat(1)).toBe(teamOfSeat(3))
    const r = fourHandRoster([
      { seat: 0, name: 'Ada' },
      { seat: 1, name: 'Vel' },
    ])
    expect(r.humans).toEqual([true, true, false, false])
    expect(r.names[0]).toBe('Ada')
    expect(r.names[1]).toBe('Vel')
    expect(r.names[2]).toBe('Brass')
    expect(r.names[3]).toBe('Velvet')
  })

  it('describes adjacent humans as versus and opposite humans as co-op', () => {
    const adjacent = chairsFromOccupants(
      [
        { seat: 0, name: 'Ada' },
        { seat: 1, name: 'Vel' },
      ],
      0,
    )
    expect(matchupSentence(adjacent, 0)).toMatch(/Versus: you vs Vel/)
    const opposite = chairsFromOccupants(
      [
        { seat: 0, name: 'Ada' },
        { seat: 2, name: 'Vel' },
      ],
      0,
    )
    expect(opposite[2]!.relation).toBe('partner')
    expect(matchupSentence(opposite, 0)).toMatch(/Co-op: you and Vel/)
  })

  it('names the singleton computer partner when three humans sit', () => {
    const chairs = chairsFromOccupants(
      [
        { seat: 0, name: 'Ada' },
        { seat: 1, name: 'Vel' },
        { seat: 2, name: 'Kit' },
      ],
      1,
    )
    expect(chairs[3]!.computer).toBe(true)
    expect(matchupSentence(chairs, 1)).toMatch(/computer partner/)
  })
})
