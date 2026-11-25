import { areAdjacent } from '../core/warfront/map'
import { applyWarfrontMove, ownedFacilityZones } from '../core/warfront/rules'
import {
  estimateAtk,
  estimateDef,
  hasUnits,
  occupationCount,
  rangedCount,
  stackCount,
  subUnits,
} from '../core/warfront/stacks'
import { unitCatalog, type UnitStack, type WarfrontMove, type WarfrontState } from '../core/warfront/types'

export const WARFRONT_BOT_MS = 650

export function warfrontBotShouldAct(state: WarfrontState): boolean {
  if (state.phase === 'gameEnd') return false
  const id = state.turnPlayerId
  if (!id) return false
  const pl = state.players.find((p) => p.id === id)
  return Boolean(pl?.isComputer && !pl.eliminated)
}

function bias(state: WarfrontState): number {
  if (state.config.difficulty === 'easy') return 1.4
  if (state.config.difficulty === 'hard') return 0.95
  return 1.1
}

function pickBuy(state: WarfrontState, playerId: string): WarfrontMove | null {
  const pl = state.players.find((p) => p.id === playerId)
  if (!pl || pl.pp < 3) return null
  const facs = ownedFacilityZones(state, playerId)
  if (!facs.length) return null
  // Prefer facility with fewest units
  let bestZone = facs[0]!
  let bestN = Infinity
  for (const z of facs) {
    const n = stackCount(state.zones[z]!.units)
    if (n < bestN) {
      bestN = n
      bestZone = z
    }
  }
  if (bestN >= 8) return null
  const catalog = unitCatalog(state.config.theater)
  // Prefer infantry/escort, then tank/capital if rich
  const prefer = [...catalog].sort((a, b) => a.cost - b.cost)
  for (const def of prefer) {
    if (pl.pp >= def.cost && bestN + 1 <= 8) {
      // Hard: buy tanks when PP allows and frontline exists
      if (state.config.difficulty === 'hard' && pl.pp >= 6) {
        const heavy = catalog.find((d) => d.unit === 'tank' || d.unit === 'capital')
        if (heavy && pl.pp >= heavy.cost) {
          return { type: 'buy', playerId, unit: heavy.unit, zoneId: bestZone, count: 1 }
        }
      }
      return { type: 'buy', playerId, unit: def.unit, zoneId: bestZone, count: 1 }
    }
  }
  return null
}

function pickRanged(state: WarfrontState, playerId: string): WarfrontMove | null {
  for (let from = 0; from < state.zones.length; from++) {
    const z = state.zones[from]!
    if (z.ownerId !== playerId) continue
    if (rangedCount(z.units) < 1) continue
    for (const to of state.adj[from] ?? []) {
      const tz = state.zones[to]!
      if (!tz.ownerId || tz.ownerId === playerId) continue
      const enemy = state.players.find((p) => p.id === tz.ownerId)
      if (state.config.align === 'teams') {
        const me = state.players.find((p) => p.id === playerId)
        if (me?.teamId && enemy?.teamId === me.teamId) continue
      }
      const enemyStr = estimateDef(tz.units)
      if (enemyStr <= 4 || state.config.difficulty !== 'easy') {
        return { type: 'ranged', playerId, fromZoneId: from, toZoneId: to }
      }
    }
  }
  return null
}

function allOccupyUnits(stack: UnitStack): UnitStack {
  const out: UnitStack = {}
  for (const [k, v] of Object.entries(stack)) {
    if (!v) continue
    // Leave 1 infantry behind if possible
    out[k as keyof UnitStack] = v
  }
  return out
}

function pickMove(state: WarfrontState, playerId: string): WarfrontMove | null {
  const b = bias(state)
  type Cand = { from: number; to: number; units: UnitStack; score: number }
  const cands: Cand[] = []

  for (let from = 0; from < state.zones.length; from++) {
    const z = state.zones[from]!
    if (z.ownerId !== playerId || !hasUnits(z.units)) continue
    for (const to of state.adj[from] ?? []) {
      if (!areAdjacent(state.adj, from, to)) continue
      const tz = state.zones[to]!
      if (tz.ownerId && tz.ownerId !== playerId) {
        const enemy = state.players.find((p) => p.id === tz.ownerId)
        const me = state.players.find((p) => p.id === playerId)
        if (
          state.config.align === 'teams' &&
          me?.teamId &&
          enemy?.teamId === me.teamId
        ) {
          continue
        }
        // Attack with most of stack, leave 0–1 behind
        let units = allOccupyUnits(z.units)
        if (stackCount(units) > 1) {
          const leave: UnitStack = { infantry: 1 }
          if (state.config.theater === 'sea') {
            leave.infantry = undefined
            leave.escort = 1
          }
          const trimmed = subUnits(units, leave)
          if (trimmed && occupationCount(trimmed) > 0) units = trimmed
        }
        const atk = estimateAtk(units, Boolean(tz.units.tank))
        const def = estimateDef(tz.units)
        if (atk > def * b) {
          cands.push({
            from,
            to,
            units,
            score: atk - def + (tz.facility ? 3 : 0),
          })
        }
      } else if (!tz.ownerId) {
        // Expand into empty
        const units: UnitStack =
          state.config.theater === 'sea'
            ? { escort: Math.min(2, z.units.escort ?? 0) || undefined }
            : { infantry: Math.min(2, z.units.infantry ?? 0) || undefined }
        // clean undefined
        const cleaned: UnitStack = {}
        for (const [k, v] of Object.entries(units)) {
          if (v && v > 0) cleaned[k as keyof UnitStack] = v
        }
        if (occupationCount(cleaned) > 0) {
          cands.push({ from, to, units: cleaned, score: tz.facility ? 2 : 0.5 })
        }
      }
    }
  }

  cands.sort((a, b2) => b2.score - a.score)
  const best = cands[0]
  if (!best) return null
  return {
    type: 'move',
    playerId,
    fromZoneId: best.from,
    toZoneId: best.to,
    units: best.units,
  }
}

/** Choose and apply one bot action; returns same state if idle. */
export function warfrontBotStep(state: WarfrontState): WarfrontState {
  if (!warfrontBotShouldAct(state)) return state
  const playerId = state.turnPlayerId!
  let move: WarfrontMove | null = null

  if (state.phase === 'buy') {
    move = pickBuy(state, playerId)
    if (!move) move = { type: 'skipBuy', playerId }
  } else if (state.phase === 'ranged') {
    move = pickRanged(state, playerId)
    if (!move) move = { type: 'skipRanged', playerId }
  } else if (state.phase === 'move') {
    if (!state.moved) {
      move = pickMove(state, playerId)
      if (!move) move = { type: 'skipMove', playerId }
    } else {
      move = { type: 'endTurn', playerId }
    }
  } else {
    move = { type: 'endTurn', playerId }
  }

  const res = applyWarfrontMove(state, move)
  if (!res.ok) {
    // Force end turn on failure
    const end = applyWarfrontMove(state, { type: 'endTurn', playerId })
    return end.ok ? end.state : state
  }

  // After buy, optionally buy one more then skip; after move, end turn
  let next = res.state
  if (next.phase === 'buy' && next.turnPlayerId === playerId) {
    const again = pickBuy(next, playerId)
    if (again) {
      const r2 = applyWarfrontMove(next, again)
      if (r2.ok) next = r2.state
    }
    const skip = applyWarfrontMove(next, { type: 'skipBuy', playerId })
    if (skip.ok) next = skip.state
  }
  if (next.phase === 'move' && next.moved && next.turnPlayerId === playerId) {
    const end = applyWarfrontMove(next, { type: 'endTurn', playerId })
    if (end.ok) next = end.state
  }
  return next
}

export function fillWarfrontBots(
  state: WarfrontState,
  opts?: { maxSteps?: number },
): WarfrontState {
  const max = opts?.maxSteps ?? 24
  let cur = state
  for (let i = 0; i < max; i++) {
    if (!warfrontBotShouldAct(cur)) break
    const next = warfrontBotStep(cur)
    if (next === cur) break
    cur = next
  }
  return cur
}
