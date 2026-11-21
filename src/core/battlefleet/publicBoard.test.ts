import { describe, expect, it } from 'vitest'
import {
  battleFleetPublicBoardFromState,
  decodeBattleFleetPublicBoard,
  encodeBattleFleetPublicBoard,
  isBattleFleetBoardPayload,
  sanitizeBattleFleetForViewer,
} from './publicBoard'
import { applyBattleFleetMove } from './rules'
import { createBattleFleetMatch } from './state'

describe('battlefleet compact board wire', () => {
  it('round-trips F1 encoding', () => {
    let s = createBattleFleetMatch(['You', 'Bot'], [false, true], 'ffa', 'easy', 9)
    for (const id of ['p0', 'p1']) {
      let r = applyBattleFleetMove(s, { type: 'randomPlace', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
      r = applyBattleFleetMove(s, { type: 'confirmFleet', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    // A few shots
    for (let i = 0; i < 8; i++) {
      const turn = s.turnPlayerId
      if (!turn || s.phase !== 'battle') break
      const enemy = s.players.find((p) => p.id !== turn)!
      let fired = false
      for (const ship of enemy.fleet!.ships) {
        for (const c of ship.cells) {
          const r = applyBattleFleetMove(s, {
            type: 'fire',
            playerId: turn,
            x: c.x,
            y: c.y,
          })
          if (r.ok) {
            s = r.state
            fired = true
            break
          }
        }
        if (fired) break
      }
      if (!fired) break
    }

    const board = battleFleetPublicBoardFromState(s)
    const wire = encodeBattleFleetPublicBoard(board)
    expect(wire.startsWith('F1~')).toBe(true)
    expect(wire.includes('{')).toBe(false)
    expect(wire.length).toBeLessThan(1200)
    expect(isBattleFleetBoardPayload(wire)).toBe(true)

    const back = decodeBattleFleetPublicBoard(wire)
    expect(back.mode).toBe('ffa')
    expect(back.playerCount).toBe(2)
    expect(back.players.length).toBe(2)
    expect(back.marks.length).toBeGreaterThan(0)
  })

  it('stays compact after many misses', () => {
    let s = createBattleFleetMatch(['You', 'Bot'], [false, true], 'ffa', 'easy', 11)
    for (const id of ['p0', 'p1']) {
      let r = applyBattleFleetMove(s, { type: 'randomPlace', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
      r = applyBattleFleetMove(s, { type: 'confirmFleet', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    // Spray empty water in bot territory (LR quadrant for 2p)
    for (let y = 10; y < 20 && s.phase === 'battle'; y++) {
      for (let x = 10; x < 20 && s.phase === 'battle'; x++) {
        if (s.turnPlayerId !== 'p0') {
          // bot turn — skip by forcing turn
          s = { ...s, turnPlayerId: 'p0' }
        }
        const r = applyBattleFleetMove(s, { type: 'fire', playerId: 'p0', x, y })
        if (r.ok) s = r.state
      }
    }
    const wire = encodeBattleFleetPublicBoard(battleFleetPublicBoardFromState(s))
    expect(wire.length).toBeLessThan(1800)
  })

  it('sanitize hides living enemy ships but keeps own fleet', () => {
    let s = createBattleFleetMatch(['You', 'Bot'], [false, true], 'ffa', 'easy', 3)
    for (const id of ['p0', 'p1']) {
      let r = applyBattleFleetMove(s, { type: 'randomPlace', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
      r = applyBattleFleetMove(s, { type: 'confirmFleet', playerId: id })
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    const view = sanitizeBattleFleetForViewer(s, 'p0')
    expect(view.players[0]!.fleet!.ships.length).toBe(5)
    expect(view.players[1]!.fleet!.ships.length).toBe(0)
  })
})
