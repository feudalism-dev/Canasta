import { cellKey, ffaTerritory, inBoard } from '../core/battlefleet/board'
import { applyBattleFleetMove } from '../core/battlefleet/rules'
import type {
  BattleFleetDifficulty,
  BattleFleetMove,
  BattleFleetState,
  Cell,
} from '../core/battlefleet/types'
import { BOARD_SIZE } from '../core/battlefleet/types'

function shotSet(state: BattleFleetState): Set<string> {
  return new Set(state.shots.map((s) => cellKey(s.x, s.y)))
}

function legalTargets(state: BattleFleetState, attackerId: string): Cell[] {
  const attacked = shotSet(state)
  const out: Cell[] = []
  const attacker = state.players.find((p) => p.id === attackerId)
  if (!attacker) return out

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (attacked.has(cellKey(x, y))) continue
      if (state.config.mode === 'teams') {
        const team =
          y < 10 ? 'A' : 'B'
        if (team === attacker.teamId) continue
        const t = state.teams?.find((z) => z.id === team)
        if (!t || t.eliminated) continue
        out.push({ x, y })
      } else {
        // FFA: any other active player's territory
        for (let i = 0; i < state.config.playerCount; i++) {
          const terr = ffaTerritory(i, state.config.playerCount)
          if (!terr) continue
          if (
            x >= terr.x0 &&
            y >= terr.y0 &&
            x < terr.x0 + terr.width &&
            y < terr.y0 + terr.height
          ) {
            const target = state.players[i]!
            if (target.id !== attackerId && !target.eliminated) out.push({ x, y })
            break
          }
        }
      }
    }
  }
  return out
}

function neighbors(x: number, y: number): Cell[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((c) => inBoard(c.x, c.y))
}

function pickRandom<T>(arr: T[], seed: number): T | null {
  if (!arr.length) return null
  return arr[Math.abs(seed) % arr.length]!
}

export function chooseBattleFleetAttack(
  state: BattleFleetState,
  playerId: string,
  difficulty: BattleFleetDifficulty,
): BattleFleetMove | null {
  const targets = legalTargets(state, playerId)
  if (!targets.length) return null

  if (difficulty === 'easy') {
    const pick = pickRandom(targets, state.seed + state.shots.length * 17)
    return pick ? { type: 'fire', playerId, x: pick.x, y: pick.y } : null
  }

  // Normal/Hard: hunt adjacent to unresolved hits
  const attacked = shotSet(state)
  const openHits = state.shots.filter((s) => s.result === 'hit')
  const hunt: Cell[] = []
  for (const h of openHits) {
    // Skip if this hit's ship is already fully sunk (all its cells marked sunk via later sunk result)
    for (const n of neighbors(h.x, h.y)) {
      if (!attacked.has(cellKey(n.x, n.y)) && targets.some((t) => t.x === n.x && t.y === n.y)) {
        hunt.push(n)
      }
    }
  }
  if (hunt.length) {
    const pick = pickRandom(hunt, state.seed + state.shots.length * 31)
    if (pick) return { type: 'fire', playerId, x: pick.x, y: pick.y }
  }

  // Hard: slight bias toward denser untested areas (simple parity hunt)
  if (difficulty === 'hard') {
    const parity = targets.filter((t) => (t.x + t.y) % 2 === (state.seed % 2))
    const pool = parity.length ? parity : targets
    const pick = pickRandom(pool, state.seed + state.shots.length * 41)
    return pick ? { type: 'fire', playerId, x: pick.x, y: pick.y } : null
  }

  const pick = pickRandom(targets, state.seed + state.shots.length * 19)
  return pick ? { type: 'fire', playerId, x: pick.x, y: pick.y } : null
}

/** Pause between computer shots so HUD / table can show each result. */
export const BATTLEFLEET_BOT_SHOT_MS = 700

export type FillBattleFleetBotsOpts = {
  /** Cap battle-phase shots this call (default unlimited). Use 0 for placement-only. */
  maxBattleShots?: number
}

/** Run computer placement + confirms + attacks until a human must act or game ends. */
export function fillBattleFleetBots(
  state: BattleFleetState,
  opts?: FillBattleFleetBotsOpts,
): BattleFleetState {
  const maxBattle = opts?.maxBattleShots ?? 999
  let battleShots = 0
  let cur = state
  for (let guard = 0; guard < 80; guard++) {
    if (cur.phase === 'gameEnd') return cur

    if (cur.phase === 'placement') {
      // Each computer side that isn't confirmed: random place + confirm
      let progressed = false
      if (cur.config.mode === 'teams') {
        for (const team of cur.teams ?? []) {
          if (team.fleet.confirmed) continue
          const member = cur.players.find(
            (p) => team.memberIds.includes(p.id) && p.isComputer,
          )
          // If any human on team, humans place — bots only if ALL members are computers
          const humans = team.memberIds.filter(
            (id) => !cur.players.find((p) => p.id === id)?.isComputer,
          )
          if (humans.length) continue
          if (!member) continue
          let r = applyBattleFleetMove(cur, { type: 'randomPlace', playerId: member.id })
          if (!r.ok) continue
          r = applyBattleFleetMove(r.state, { type: 'confirmFleet', playerId: member.id })
          if (r.ok) {
            cur = r.state
            progressed = true
          }
        }
      } else {
        for (const pl of cur.players) {
          if (!pl.isComputer || pl.fleet?.confirmed) continue
          let r = applyBattleFleetMove(cur, { type: 'randomPlace', playerId: pl.id })
          if (!r.ok) continue
          r = applyBattleFleetMove(r.state, { type: 'confirmFleet', playerId: pl.id })
          if (r.ok) {
            cur = r.state
            progressed = true
          }
        }
      }
      if (!progressed) return cur
      continue
    }

    if (cur.phase === 'battle' && cur.turnPlayerId) {
      if (battleShots >= maxBattle) return cur
      const pl = cur.players.find((p) => p.id === cur.turnPlayerId)
      if (!pl || !pl.isComputer) return cur
      const move = chooseBattleFleetAttack(cur, pl.id, cur.config.difficulty)
      if (!move) return cur
      const r = applyBattleFleetMove(cur, move)
      if (!r.ok) return cur
      cur = r.state
      battleShots += 1
      continue
    }

    return cur
  }
  return cur
}

/** True when the current battle turn belongs to a computer. */
export function battleFleetBotShouldAct(state: BattleFleetState): boolean {
  if (state.phase !== 'battle' || !state.turnPlayerId) return false
  const pl = state.players.find((p) => p.id === state.turnPlayerId)
  return Boolean(pl?.isComputer && !pl.eliminated)
}
