import { describe, expect, it } from 'vitest'
import { battleFleetPublicBoardFromState } from './publicBoard'
import { applyBattleFleetMove, markBattleFleetDeparture } from './rules'
import { assignBattleFleetTeamsBySeat, createBattleFleetMatch, withPhysicalSeats } from './state'
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

describe('battlefleet acceptance modes', () => {
  function placeAndConfirm(s: ReturnType<typeof createBattleFleetMatch>, id: string) {
    let cur = s
    let r = applyBattleFleetMove(cur, { type: 'randomPlace', playerId: id })
    if (!r.ok) throw new Error(r.error)
    cur = r.state
    r = applyBattleFleetMove(cur, { type: 'confirmFleet', playerId: id })
    if (!r.ok) throw new Error(r.error)
    return r.state
  }

  it('three-player FFA reaches battle with three fleets', () => {
    let s = createBattleFleetMatch(
      ['A', 'B', 'C'],
      [false, true, true],
      'ffa',
      'easy',
      21,
    )
    expect(s.config.playerCount).toBe(3)
    for (const id of ['p0', 'p1', 'p2']) s = placeAndConfirm(s, id)
    expect(s.phase).toBe('battle')
    expect(s.players.every((p) => (p.fleet?.ships.length ?? 0) === 5)).toBe(true)
  })

  it('four-player FFA reaches battle', () => {
    let s = createBattleFleetMatch(
      ['A', 'B', 'C', 'D'],
      [false, true, true, true],
      'ffa',
      'normal',
      22,
    )
    for (const id of ['p0', 'p1', 'p2', 'p3']) s = placeAndConfirm(s, id)
    expect(s.phase).toBe('battle')
    expect(s.players).toHaveLength(4)
  })

  it('FFA mid-game elimination skips the out player and blocks their fire', () => {
    let s = createBattleFleetMatch(
      ['A', 'B', 'C'],
      [false, true, true],
      'ffa',
      'easy',
      99,
    )
    for (const id of ['p0', 'p1', 'p2']) {
      let r = applyBattleFleetMove(s, { type: 'randomPlace', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
      r = applyBattleFleetMove(s, { type: 'confirmFleet', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    expect(s.phase).toBe('battle')

    const victimFleet = s.players[1]!.fleet!
    for (const ship of victimFleet.ships) {
      for (const c of ship.cells) {
        s = { ...s, turnPlayerId: 'p0' }
        const r = applyBattleFleetMove(s, {
          type: 'fire',
          playerId: 'p0',
          x: c.x,
          y: c.y,
        })
        if (!r.ok) throw new Error(r.error)
        s = r.state
      }
    }
    expect(s.players[1]!.eliminated).toBe(true)
    expect(s.phase).toBe('battle')

    for (let i = 0; i < 8; i++) {
      if (s.phase !== 'battle' || !s.turnPlayerId) break
      expect(s.turnPlayerId).not.toBe('p1')
      const shooter = s.turnPlayerId
      let fired = false
      for (let y = 0; y < 20 && !fired; y++) {
        for (let x = 0; x < 20 && !fired; x++) {
          const r = applyBattleFleetMove(s, {
            type: 'fire',
            playerId: shooter,
            x,
            y,
          })
          if (r.ok) {
            s = r.state
            fired = true
          }
        }
      }
      if (!fired) break
    }

    const forced = { ...s, turnPlayerId: 'p1', phase: 'battle' as const }
    const bad = applyBattleFleetMove(forced, {
      type: 'fire',
      playerId: 'p1',
      x: 0,
      y: 0,
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/eliminated/i)
  })

  it('team elimination awards win to opposing team', () => {
    let s = createBattleFleetMatch(
      ['A1', 'A2', 'B1', 'B2'],
      [false, false, true, true],
      'teams',
      'easy',
      23,
    )
    s = placeAndConfirm(s, 'p0')
    s = placeAndConfirm(s, 'p2')
    expect(s.phase).toBe('battle')

    // Sink every Team B ship as p0 (force turn)
    const victimFleet = s.teams!.find((t) => t.id === 'B')!.fleet
    for (const ship of victimFleet.ships) {
      for (const c of ship.cells) {
        s = { ...s, turnPlayerId: 'p0' }
        const r = applyBattleFleetMove(s, {
          type: 'fire',
          playerId: 'p0',
          x: c.x,
          y: c.y,
        })
        if (!r.ok) throw new Error(r.error)
        s = r.state
      }
    }
    expect(s.phase).toBe('gameEnd')
    expect(s.winnerTeamId).toBe('A')
    expect(s.teams!.find((t) => t.id === 'B')!.eliminated).toBe(true)
  })

  it('departure converts human to computer without wiping fleet', () => {
    let s = createBattleFleetMatch(['You', 'Bot'], [false, true], 'ffa', 'easy', 24)
    s = placeAndConfirm(s, 'p0')
    s = placeAndConfirm(s, 'p1')
    const before = s.players[0]!.fleet!.ships.length
    s = markBattleFleetDeparture(s, 'p0')
    expect(s.players[0]!.isComputer).toBe(true)
    expect(s.players[0]!.fleet!.ships.length).toBe(before)
    expect(s.players[0]!.eliminated).toBe(false)
  })

  it('assigns opposite seats as team partners', () => {
    let s = createBattleFleetMatch(
      ['P0', 'P1', 'P2', 'P3'],
      [false, false, false, false],
      'teams',
      'easy',
      25,
    )
    s = withPhysicalSeats(s, [0, 1, 2, 3])
    s = assignBattleFleetTeamsBySeat(s)
    expect(s.players.find((p) => p.seat === 0)?.teamId).toBe('A')
    expect(s.players.find((p) => p.seat === 2)?.teamId).toBe('A')
    expect(s.players.find((p) => p.seat === 1)?.teamId).toBe('B')
    expect(s.players.find((p) => p.seat === 3)?.teamId).toBe('B')
  })
})
