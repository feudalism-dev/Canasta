import { describe, expect, it } from 'vitest'
import { applyWarfrontMove, resolveCombat } from './rules'
import { createWarfrontMatch } from './state'
import { STACK_CAP, VP_TO_WIN } from './types'

describe('warfront setup', () => {
  it('creates land match with 28 zones and starting armies', () => {
    const s = createWarfrontMatch(['You', 'Bot'], [false, true], 'land', 'ffa', 'normal', 42)
    expect(s.zones.length).toBe(28)
    expect(s.players).toHaveLength(2)
    expect(s.phase).toBe('buy')
    expect(s.turnPlayerId).toBeTruthy()
    const home = s.zones[s.players[0]!.homeZoneId]!
    expect(home.facility).toBe(true)
    expect(home.ownerId).toBe(s.players[0]!.id)
    expect((home.units.infantry ?? 0) + (home.units.tank ?? 0)).toBeGreaterThan(0)
  })

  it('teams mode requires 4 and assigns A/B', () => {
    const s = createWarfrontMatch(
      ['A', 'B', 'C', 'D'],
      [false, true, true, true],
      'land',
      'teams',
      'normal',
      1,
    )
    expect(s.players.every((p) => p.teamId === 'A' || p.teamId === 'B')).toBe(true)
  })
})

describe('warfront economy and buy', () => {
  it('income grants PP and allows buy at facility', () => {
    let s = createWarfrontMatch(['You', 'Bot'], [false, true], 'land', 'ffa', 'normal', 7)
    const actor = s.turnPlayerId!
    const pl = s.players.find((p) => p.id === actor)!
    expect(pl.pp).toBeGreaterThanOrEqual(1)
    // Seed bank so a 3-PP infantry is affordable on turn 1
    s = structuredClone(s)
    s.players.find((p) => p.id === actor)!.pp = 5
    const fac = s.zones.findIndex((z) => z.ownerId === actor && z.facility)
    expect(fac).toBeGreaterThanOrEqual(0)
    const res = applyWarfrontMove(s, {
      type: 'buy',
      playerId: actor,
      unit: 'infantry',
      zoneId: fac,
      count: 1,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const after = res.state.players.find((p) => p.id === actor)!
    expect(after.pp).toBe(2)
  })

  it('rejects place away from facility', () => {
    const s = createWarfrontMatch(['You', 'Bot'], [false, true], 'land', 'ffa', 'normal', 3)
    const actor = s.turnPlayerId!
    const nonFac = s.zones.findIndex((z) => z.ownerId === actor && !z.facility)
    const res = applyWarfrontMove(s, {
      type: 'buy',
      playerId: actor,
      unit: 'infantry',
      zoneId: nonFac,
    })
    expect(res.ok).toBe(false)
  })
})

describe('warfront combat', () => {
  it('resolveCombat eventually clears a weak defender', () => {
    const r = resolveCombat({ tank: 3 }, { infantry: 1 }, 99)
    expect(Object.values(r.defender).every((n) => !n)).toBe(true)
  })

  it('move into empty adjacent captures', () => {
    let s = createWarfrontMatch(['You', 'Bot'], [false, true], 'land', 'ffa', 'normal', 11)
    const id = s.players[0]!.id
    // Manually set phase for unit test
    s = { ...s, turnPlayerId: id, phase: 'move', moved: false, rangedUsed: true }
    const from = s.players[0]!.homeZoneId
    const to = s.adj[from]!.find((z) => s.zones[z]!.ownerId == null)
    if (to == null) {
      // pick satellite neighbor that is owned — reinforce path
      const sat = s.adj[from]![0]!
      const res = applyWarfrontMove(s, {
        type: 'move',
        playerId: id,
        fromZoneId: from,
        toZoneId: sat,
        units: { infantry: 1 },
      })
      expect(res.ok).toBe(true)
      return
    }
    const res = applyWarfrontMove(s, {
      type: 'move',
      playerId: id,
      fromZoneId: from,
      toZoneId: to,
      units: { infantry: 1 },
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.zones[to]!.ownerId).toBe(id)
  })
})

describe('warfront constants', () => {
  it('exports stack and vp caps', () => {
    expect(STACK_CAP).toBe(8)
    expect(VP_TO_WIN).toBe(12)
  })
})
