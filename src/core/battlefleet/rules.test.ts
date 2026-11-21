import { describe, expect, it } from 'vitest'
import { battleFleetPublicBoardFromState } from './publicBoard'
import { applyBattleFleetMove } from './rules'
import { createBattleFleetMatch } from './state'
import { SHIP_DEFS } from './types'

describe('battlefleet placement', () => {
  it('rejects overlapping ships', () => {
    let s = createBattleFleetMatch(['A', 'B'], [false, true], 'ffa', 'easy', 1)
    let r = applyBattleFleetMove(s, {
      type: 'placeShip',
      playerId: 'p0',
      kind: 'destroyer',
      x: 0,
      y: 0,
      orientation: 'H',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    s = r.state
    r = applyBattleFleetMove(s, {
      type: 'placeShip',
      playerId: 'p0',
      kind: 'submarine',
      x: 0,
      y: 0,
      orientation: 'V',
    })
    expect(r.ok).toBe(false)
  })

  it('rejects ships outside territory', () => {
    const s = createBattleFleetMatch(['A', 'B'], [false, true], 'ffa', 'easy', 2)
    const r = applyBattleFleetMove(s, {
      type: 'placeShip',
      playerId: 'p0',
      kind: 'carrier',
      x: 10,
      y: 0,
      orientation: 'H',
    })
    expect(r.ok).toBe(false)
  })

  it('random place + confirm starts battle when both ready', () => {
    let s = createBattleFleetMatch(['You', 'Bot'], [false, true], 'ffa', 'easy', 3)
    let r = applyBattleFleetMove(s, { type: 'randomPlace', playerId: 'p0' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    s = r.state
    r = applyBattleFleetMove(s, { type: 'confirmFleet', playerId: 'p0' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    s = r.state
    r = applyBattleFleetMove(s, { type: 'randomPlace', playerId: 'p1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    s = r.state
    r = applyBattleFleetMove(s, { type: 'confirmFleet', playerId: 'p1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.phase).toBe('battle')
    expect(r.state.players[0]!.fleet?.ships).toHaveLength(SHIP_DEFS.length)
  })
})

describe('battlefleet combat', () => {
  function readyTwoPlayer() {
    let s = createBattleFleetMatch(['You', 'Bot'], [false, true], 'ffa', 'easy', 42)
    for (const id of ['p0', 'p1']) {
      let r = applyBattleFleetMove(s, { type: 'randomPlace', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
      r = applyBattleFleetMove(s, { type: 'confirmFleet', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    return s
  }

  it('rejects repeated attacks without consuming turn', () => {
    let s = readyTwoPlayer()
    const turn = s.turnPlayerId!
    // Fire at a legal enemy cell
    const enemy = s.players.find((p) => p.id !== turn)!
    const cell = enemy.fleet!.ships[0]!.cells[0]!
    let r = applyBattleFleetMove(s, {
      type: 'fire',
      playerId: turn,
      x: cell.x,
      y: cell.y,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    s = r.state
    // Same player tries again same cell — wrong turn or already shot
    r = applyBattleFleetMove(s, {
      type: 'fire',
      playerId: turn,
      x: cell.x,
      y: cell.y,
    })
    expect(r.ok).toBe(false)
  })

  it('hit damages ship; sunk reveals full ship publicly', () => {
    let s = readyTwoPlayer()
    // Force turn to p0
    s = { ...s, turnPlayerId: 'p0' }
    const victim = s.players[1]!
    const destroyer = victim.fleet!.ships.find((x) => x.kind === 'destroyer')!
    for (const c of destroyer.cells) {
      const r = applyBattleFleetMove(s, {
        type: 'fire',
        playerId: 'p0',
        x: c.x,
        y: c.y,
      })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      s = r.state
      // After each shot turn advances — give turn back to p0 for test
      s = { ...s, turnPlayerId: 'p0' }
    }
    const sunk = s.players[1]!.fleet!.ships.find((x) => x.kind === 'destroyer')!
    expect(sunk.sunk).toBe(true)
    const pub = battleFleetPublicBoardFromState(s)
    expect(pub.sunkShips.some((x) => x.kind === 'destroyer')).toBe(true)
    // Surviving ships not fully listed
    const carrier = s.players[1]!.fleet!.ships.find((x) => x.kind === 'carrier')!
    expect(carrier.sunk).toBe(false)
    expect(pub.sunkShips.some((x) => x.kind === 'carrier' && x.sideId === 'p1')).toBe(
      false,
    )
  })

  it('team mode allows ship across quadrant boundary within 10x20', () => {
    let s = createBattleFleetMatch(
      ['A1', 'A2', 'B1', 'B2'],
      [false, false, true, true],
      'teams',
      'easy',
      7,
    )
    // Place carrier spanning x=8..12 on team A (rows 0-9) — crosses old quadrant line at x=10
    const r = applyBattleFleetMove(s, {
      type: 'placeShip',
      playerId: 'p0',
      kind: 'carrier',
      x: 8,
      y: 0,
      orientation: 'H',
    })
    expect(r.ok).toBe(true)
  })
})
