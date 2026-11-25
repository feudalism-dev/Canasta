import { areAdjacent } from './map'
import {
  addUnits,
  cloneStack,
  estimateAtk,
  estimateDef,
  fitsCap,
  hasTank,
  hasUnits,
  occupationCount,
  rangedCount,
  stackCount,
  subUnits,
} from './stacks'
import {
  applyIncome,
  checkWin,
  cloneWarfront,
  playerById,
} from './state'
import {
  COMBAT_MAX_ROUNDS,
  unitDef,
  type UnitStack,
  type WarfrontMove,
  type WarfrontState,
  type WarfrontUnit,
} from './types'

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s % 1000) / 1000
  }
}

function rollHit(strength: number, rand: () => number): boolean {
  if (strength <= 0) return false
  const need = Math.min(6, strength)
  const roll = Math.floor(rand() * 6) + 1
  return roll <= need
}

function removeCasualties(stack: UnitStack, hits: number): UnitStack {
  if (hits <= 0) return cloneStack(stack)
  // Remove cheapest / weakest first (infantry/escort preference)
  const order: WarfrontUnit[] = [
    'infantry',
    'escort',
    'antitank',
    'sub',
    'artillery',
    'carrier',
    'tank',
    'capital',
  ]
  const out = cloneStack(stack)
  let left = hits
  for (const u of order) {
    if (left <= 0) break
    const have = out[u] ?? 0
    if (have <= 0) continue
    const take = Math.min(have, left)
    const next = have - take
    if (next <= 0) delete out[u]
    else out[u] = next
    left -= take
  }
  return out
}

function allies(
  state: WarfrontState,
  a: string,
  b: string,
): boolean {
  if (a === b) return true
  if (state.config.align !== 'teams') return false
  const pa = playerById(state, a)
  const pb = playerById(state, b)
  return Boolean(pa?.teamId && pb?.teamId && pa.teamId === pb.teamId)
}

function countHits(
  stack: UnitStack,
  mode: 'atk' | 'def',
  enemyTanks: boolean,
  rand: () => number,
): number {
  let hits = 0
  for (const [k, v] of Object.entries(stack)) {
    if (!v) continue
    const unit = k as WarfrontUnit
    const d = unitDef(unit)
    if (!d) continue
    let str = mode === 'atk' ? d.atk : d.def
    if (mode === 'atk' && unit === 'antitank' && enemyTanks) str += 1
    for (let i = 0; i < v; i++) {
      if (rollHit(str, rand)) hits += 1
    }
  }
  return hits
}

export function resolveCombat(
  attacker: UnitStack,
  defender: UnitStack,
  seed: number,
): { attacker: UnitStack; defender: UnitStack; rounds: number } {
  let atk = cloneStack(attacker)
  let def = cloneStack(defender)
  const rand = rng(seed)
  let rounds = 0
  while (hasUnits(atk) && hasUnits(def) && rounds < COMBAT_MAX_ROUNDS) {
    rounds += 1
    const aHits = countHits(atk, 'atk', hasTank(def), rand)
    const dHits = countHits(def, 'def', hasTank(atk), rand)
    atk = removeCasualties(atk, dHits)
    def = removeCasualties(def, aHits)
  }
  return { attacker: atk, defender: def, rounds }
}

function advanceToNext(state: WarfrontState): WarfrontState {
  let next = checkWin(state)
  if (next.phase === 'gameEnd') return next
  const order = next.turnOrder
  const cur = next.turnPlayerId ? order.indexOf(next.turnPlayerId) : -1
  for (let i = 1; i <= order.length; i++) {
    const id = order[(cur + i + order.length) % order.length]!
    const pl = playerById(next, id)
    if (!pl || pl.eliminated) continue
    if (next.config.align === 'teams' && pl.teamId) {
      const matesAlive = next.players.some(
        (p) => p.teamId === pl.teamId && !p.eliminated,
      )
      if (!matesAlive) continue
    }
    // New round marker when wrapping to first alive after last
    if (cur >= 0 && (cur + i) % order.length === 0) next.round += 1
    next = applyIncome(next, id)
    next.turnPlayerId = id
    return next
  }
  next.phase = 'gameEnd'
  next.lastMessage = 'No active players remain.'
  return next
}

export function applyWarfrontMove(
  state: WarfrontState,
  move: WarfrontMove,
): { ok: true; state: WarfrontState } | { ok: false; error: string } {
  if (state.phase === 'gameEnd') return { ok: false, error: 'Game over.' }
  const actor = move.playerId
  if (state.turnPlayerId !== actor) return { ok: false, error: 'Not your turn.' }
  const pl = playerById(state, actor)
  if (!pl || pl.eliminated) return { ok: false, error: 'Player eliminated.' }

  if (move.type === 'buy') {
    if (state.phase !== 'buy') return { ok: false, error: 'Not buy phase.' }
    const def = unitDef(move.unit)
    if (!def || def.theater !== state.config.theater) {
      return { ok: false, error: 'Invalid unit for theater.' }
    }
    const count = Math.max(1, Math.min(STACK_CAP_SAFE, move.count ?? 1))
    const cost = def.cost * count
    if (pl.pp < cost) return { ok: false, error: 'Not enough PP.' }
    const zone = state.zones[move.zoneId]
    if (!zone) return { ok: false, error: 'Invalid zone.' }
    if (zone.ownerId !== actor) return { ok: false, error: 'Must own the zone.' }
    if (!zone.facility) return { ok: false, error: 'Place only at facilities.' }
    const add: UnitStack = { [move.unit]: count }
    if (!fitsCap(zone.units, add)) return { ok: false, error: 'Stack cap exceeded.' }

    const next = cloneWarfront(state)
    const npl = playerById(next, actor)!
    npl.pp -= cost
    next.zones[move.zoneId]!.units = addUnits(next.zones[move.zoneId]!.units, add)
    next.lastMessage = `${npl.name} built ${count}× ${def.label} at zone ${move.zoneId}.`
    next.log.push(next.lastMessage)
    return { ok: true, state: next }
  }

  if (move.type === 'skipBuy') {
    if (state.phase !== 'buy') return { ok: false, error: 'Not buy phase.' }
    const next = cloneWarfront(state)
    next.phase = 'ranged'
    next.lastMessage = `${pl.name}: buy complete — ranged optional.`
    return { ok: true, state: next }
  }

  if (move.type === 'ranged') {
    if (state.phase !== 'ranged') return { ok: false, error: 'Not ranged phase.' }
    if (state.rangedUsed) return { ok: false, error: 'Already used ranged.' }
    const from = state.zones[move.fromZoneId]
    const to = state.zones[move.toZoneId]
    if (!from || !to) return { ok: false, error: 'Invalid zone.' }
    if (from.ownerId !== actor) return { ok: false, error: 'Must own firing zone.' }
    if (!areAdjacent(state.adj, move.fromZoneId, move.toZoneId)) {
      return { ok: false, error: 'Target not adjacent.' }
    }
    if (!to.ownerId || allies(state, actor, to.ownerId)) {
      return { ok: false, error: 'No enemy to bombard.' }
    }
    if (rangedCount(from.units) < 1) {
      return { ok: false, error: 'No ranged units here.' }
    }
    const next = cloneWarfront(state)
    const rand = rng(next.seed + next.round * 97 + move.fromZoneId * 13)
    let hits = 0
    const fireStack = next.zones[move.fromZoneId]!.units
    for (const [k, v] of Object.entries(fireStack)) {
      if (!v) continue
      const d = unitDef(k as WarfrontUnit)
      if (!d?.ranged) continue
      for (let i = 0; i < v; i++) {
        // Ranged hits on ≤2
        if (rollHit(2, rand)) hits += 1
      }
    }
    next.zones[move.toZoneId]!.units = removeCasualties(
      next.zones[move.toZoneId]!.units,
      hits,
    )
    if (!hasUnits(next.zones[move.toZoneId]!.units)) {
      // Bombard cannot capture — ownership unchanged, empty enemy zone stays theirs until occupied
      next.zones[move.toZoneId]!.units = {}
    }
    next.rangedUsed = true
    next.phase = 'move'
    next.lastMessage = `${pl.name} bombard zone ${move.toZoneId}: ${hits} hit(s).`
    next.log.push(next.lastMessage)
    return { ok: true, state: checkWin(next) }
  }

  if (move.type === 'skipRanged') {
    if (state.phase !== 'ranged') return { ok: false, error: 'Not ranged phase.' }
    const next = cloneWarfront(state)
    next.phase = 'move'
    next.lastMessage = `${pl.name}: skipping ranged.`
    return { ok: true, state: next }
  }

  if (move.type === 'move') {
    if (state.phase !== 'move') return { ok: false, error: 'Not move phase.' }
    if (state.moved) return { ok: false, error: 'Already moved.' }
    const from = state.zones[move.fromZoneId]
    const to = state.zones[move.toZoneId]
    if (!from || !to) return { ok: false, error: 'Invalid zone.' }
    if (from.ownerId !== actor) return { ok: false, error: 'Must own origin.' }
    if (!areAdjacent(state.adj, move.fromZoneId, move.toZoneId)) {
      return { ok: false, error: 'Not adjacent.' }
    }
    if (!hasUnits(move.units)) return { ok: false, error: 'No units selected.' }
    const left = subUnits(from.units, move.units)
    if (!left) return { ok: false, error: 'Insufficient units.' }

    // Friendly / ally block (v1: cannot enter ally zones)
    if (to.ownerId && allies(state, actor, to.ownerId) && to.ownerId !== actor) {
      return { ok: false, error: 'Cannot enter ally zones.' }
    }

    const next = cloneWarfront(state)
    next.zones[move.fromZoneId]!.units = left
    if (!hasUnits(left) && occupationCount(left) === 0) {
      // Empty origin stays owned
    }

    const destOwner = next.zones[move.toZoneId]!.ownerId
    if (!destOwner || destOwner === actor) {
      if (!fitsCap(next.zones[move.toZoneId]!.units, move.units)) {
        return { ok: false, error: 'Stack cap at destination.' }
      }
      next.zones[move.toZoneId]!.ownerId = actor
      next.zones[move.toZoneId]!.units = addUnits(
        next.zones[move.toZoneId]!.units,
        move.units,
      )
      next.moved = true
      next.lastMessage = `${pl.name} moved into zone ${move.toZoneId}.`
      next.log.push(next.lastMessage)
      return { ok: true, state: next }
    }

    // Combat
    const combat = resolveCombat(
      move.units,
      next.zones[move.toZoneId]!.units,
      next.seed + next.round * 31 + move.toZoneId,
    )
    if (hasUnits(combat.defender)) {
      // Defender holds — attacker survivors bounce back
      next.zones[move.toZoneId]!.units = combat.defender
      next.zones[move.fromZoneId]!.units = addUnits(
        next.zones[move.fromZoneId]!.units,
        combat.attacker,
      )
      next.moved = true
      next.lastMessage = `${pl.name} failed to take zone ${move.toZoneId}.`
      next.log.push(next.lastMessage)
      return { ok: true, state: checkWin(next) }
    }

    // Attacker wins if occupation-capable units remain
    if (occupationCount(combat.attacker) > 0) {
      next.zones[move.toZoneId]!.ownerId = actor
      next.zones[move.toZoneId]!.units = combat.attacker
      next.moved = true
      next.lastMessage = `${pl.name} captured zone ${move.toZoneId}!`
      next.log.push(next.lastMessage)
      return { ok: true, state: checkWin(next) }
    }

    // Won fight but cannot occupy — bounce survivors, zone empty under old owner
    next.zones[move.toZoneId]!.units = {}
    next.zones[move.fromZoneId]!.units = addUnits(
      next.zones[move.fromZoneId]!.units,
      combat.attacker,
    )
    next.moved = true
    next.lastMessage = `${pl.name} cleared zone ${move.toZoneId} but could not occupy.`
    next.log.push(next.lastMessage)
    return { ok: true, state: checkWin(next) }
  }

  if (move.type === 'skipMove') {
    if (state.phase !== 'move') return { ok: false, error: 'Not move phase.' }
    const next = cloneWarfront(state)
    next.moved = true
    next.lastMessage = `${pl.name} holds position.`
    return { ok: true, state: next }
  }

  if (move.type === 'endTurn') {
    // Convenience: end turn from buy/ranged/move by skipping remaining steps.
    if (state.phase === 'buy' || state.phase === 'ranged' || state.phase === 'move') {
      const next = cloneWarfront(state)
      next.phase = 'move'
      next.rangedUsed = true
      next.moved = true
      next.lastMessage = `${pl.name} ends turn.`
      return { ok: true, state: advanceToNext(next) }
    }
    return { ok: false, error: 'Cannot end turn now.' }
  }

  return { ok: false, error: 'Unknown move.' }
}

const STACK_CAP_SAFE = 8

export function ownedFacilityZones(
  state: WarfrontState,
  playerId: string,
): number[] {
  const out: number[] = []
  state.zones.forEach((z, i) => {
    if (z.ownerId === playerId && z.facility) out.push(i)
  })
  return out
}

export function strengthHint(stack: UnitStack): { atk: number; def: number; n: number } {
  return {
    atk: estimateAtk(stack),
    def: estimateDef(stack),
    n: stackCount(stack),
  }
}
