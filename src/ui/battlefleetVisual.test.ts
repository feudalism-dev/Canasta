import { describe, expect, it } from 'vitest'
import {
  bfIdentityClass,
  bfSeaActive,
  bfTerritoryClass,
  buildOwnShipSegMap,
  buildPreviewSegMap,
} from './battlefleetVisual'

describe('battlefleetVisual', () => {
  it('maps seats and teams to identity classes', () => {
    expect(bfIdentityClass('ffa', { seat: 2 })).toBe('bf-id-seat-2')
    expect(bfIdentityClass('teams', { teamId: 'B' })).toBe('bf-id-team-b')
  })

  it('tints FFA territories by roster seat', () => {
    const players = [
      { id: 'p0', seat: 0, teamId: null as 'A' | 'B' | null },
      { id: 'p1', seat: 3, teamId: null },
    ]
    // 2p: UL is player 0, LR is player 1
    expect(bfTerritoryClass('ffa', 2, 1, 1, players)).toBe('bf-id-seat-0')
    expect(bfTerritoryClass('ffa', 2, 15, 15, players)).toBe('bf-id-seat-3')
    expect(bfSeaActive('ffa', 2, 5, 15)).toBe(false)
  })

  it('uses team halves in team mode', () => {
    expect(bfTerritoryClass('teams', 4, 5, 2)).toBe('bf-id-team-a')
    expect(bfTerritoryClass('teams', 4, 5, 12)).toBe('bf-id-team-b')
    expect(bfSeaActive('teams', 4, 0, 0)).toBe(true)
  })

  it('builds bow/mid/stern segments for a horizontal ship', () => {
    const m = buildOwnShipSegMap({
      confirmed: false,
      ships: [
        {
          kind: 'destroyer',
          cells: [
            { x: 2, y: 3 },
            { x: 3, y: 3 },
          ],
          hits: [],
          sunk: false,
        },
      ],
    })
    expect(m.get('2,3')?.role).toBe('bow')
    expect(m.get('3,3')?.role).toBe('stern')
    expect(m.get('2,3')?.orient).toBe('H')
  })

  it('builds preview segments for vertical placement', () => {
    const m = buildPreviewSegMap(1, 1, 'cruiser', 'V')
    expect(m.size).toBe(3)
    expect(m.get('1,1')?.role).toBe('bow')
    expect(m.get('1,3')?.role).toBe('stern')
  })
})
