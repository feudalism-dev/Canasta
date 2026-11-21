import { cellKey, inBoard, ownerIndexAt, teamIdAt } from './board'
import {
  applyHit,
  emptyFleet,
  isFleetComplete,
  placeShip,
  randomPlaceFleet,
  removeShip,
  survivingShipCount,
} from './fleet'
import {
  cloneBattleFleet,
  fleetForSide,
  sideIdForPlayer,
  territoryForPlayer,
} from './state'
import {
  HIT_POINTS,
  SINK_BONUS,
  WIN_BONUS,
  type BattleFleetMove,
  type BattleFleetState,
  type Fleet,
  type Shot,
} from './types'

function setFleetForSide(
  state: BattleFleetState,
  sideId: string,
  fleet: Fleet,
): void {
  if (state.config.mode === 'teams') {
    const team = state.teams?.find((t) => t.id === sideId)
    if (team) team.fleet = fleet
    return
  }
  const pl = state.players.find((p) => p.id === sideId)
  if (pl) pl.fleet = fleet
}

function getMutableFleet(
  state: BattleFleetState,
  playerId: string,
): { sideId: string; fleet: Fleet } | { error: string } {
  const sideId = sideIdForPlayer(state, playerId)
  if (!sideId) return { error: 'Unknown player.' }
  const fleet = fleetForSide(state, sideId)
  if (!fleet) return { error: 'No fleet for side.' }
  return { sideId, fleet }
}

function allSidesConfirmed(state: BattleFleetState): boolean {
  if (state.config.mode === 'teams') {
    return Boolean(state.teams?.every((t) => t.fleet.confirmed))
  }
  return state.players.every((p) => p.fleet?.confirmed)
}

function beginBattle(state: BattleFleetState): void {
  state.phase = 'battle'
  // First active in turn order
  state.turnPlayerId =
    state.turnOrder.find((id) => {
      const p = state.players.find((x) => x.id === id)
      return p && !p.eliminated
    }) ?? null
  state.lastMessage = `Battle begins — ${playerName(state, state.turnPlayerId)} fires first.`
  state.log.push(state.lastMessage)
}

function playerName(state: BattleFleetState, id: string | null): string {
  if (!id) return '?'
  return state.players.find((p) => p.id === id)?.name ?? id
}

function advanceTurn(state: BattleFleetState): void {
  if (state.phase !== 'battle' || !state.turnPlayerId) return
  const order = state.turnOrder
  const cur = order.indexOf(state.turnPlayerId)
  const n = order.length
  for (let i = 1; i <= n; i++) {
    const id = order[(cur + i) % n]!
    const pl = state.players.find((p) => p.id === id)
    if (!pl || pl.eliminated) continue
    // Team: if player's team eliminated, skip
    if (state.config.mode === 'teams' && pl.teamId) {
      const team = state.teams?.find((t) => t.id === pl.teamId)
      if (team?.eliminated) continue
    }
    state.turnPlayerId = id
    state.lastMessage = `${pl.name}'s turn.`
    return
  }
  state.turnPlayerId = null
}

function alreadyShot(state: BattleFleetState, x: number, y: number): boolean {
  return state.shots.some((s) => s.x === x && s.y === y)
}

function targetSideForCell(
  state: BattleFleetState,
  attackerId: string,
  x: number,
  y: number,
): { ok: true; sideId: string } | { ok: false; error: string } {
  const attacker = state.players.find((p) => p.id === attackerId)
  if (!attacker) return { ok: false, error: 'Unknown attacker.' }

  if (state.config.mode === 'teams') {
    const cellTeam = teamIdAt(x, y)
    if (!cellTeam) return { ok: false, error: 'Out of bounds.' }
    if (cellTeam === attacker.teamId) {
      return { ok: false, error: 'Cannot attack your own team territory.' }
    }
    const team = state.teams?.find((t) => t.id === cellTeam)
    if (!team || team.eliminated) {
      return { ok: false, error: 'Target territory is inactive.' }
    }
    return { ok: true, sideId: cellTeam }
  }

  const idx = ownerIndexAt(x, y, state.config.playerCount)
  if (idx < 0) return { ok: false, error: 'Inactive territory.' }
  const target = state.players[idx]!
  if (target.id === attackerId) {
    return { ok: false, error: 'Cannot attack your own territory.' }
  }
  if (target.eliminated) {
    return { ok: false, error: 'That player is eliminated.' }
  }
  return { ok: true, sideId: target.id }
}

function checkVictory(state: BattleFleetState): void {
  if (state.config.mode === 'teams') {
    const alive = state.teams?.filter((t) => !t.eliminated) ?? []
    if (alive.length === 1) {
      const win = alive[0]!
      state.phase = 'gameEnd'
      state.winnerTeamId = win.id
      state.winnerId = null
      state.turnPlayerId = null
      // Award win bonus to both teammates
      for (const mid of win.memberIds) {
        const p = state.players.find((x) => x.id === mid)
        if (p) p.score += WIN_BONUS
      }
      state.lastMessage = `Team ${win.id} wins!`
      state.log.push(state.lastMessage)
    }
    return
  }

  const alive = state.players.filter((p) => !p.eliminated)
  if (alive.length === 1) {
    const win = alive[0]!
    state.phase = 'gameEnd'
    state.winnerId = win.id
    state.winnerTeamId = null
    state.turnPlayerId = null
    win.score += WIN_BONUS
    state.lastMessage = `${win.name} wins!`
    state.log.push(state.lastMessage)
  }
}

function markEliminations(state: BattleFleetState): void {
  if (state.config.mode === 'teams') {
    for (const team of state.teams ?? []) {
      if (team.eliminated) continue
      if (survivingShipCount(team.fleet) === 0 && team.fleet.ships.length > 0) {
        team.eliminated = true
        for (const mid of team.memberIds) {
          const p = state.players.find((x) => x.id === mid)
          if (p) p.eliminated = true
        }
        state.lastMessage = `Team ${team.id} has been eliminated!`
        state.log.push(state.lastMessage)
      }
    }
    return
  }
  for (const pl of state.players) {
    if (pl.eliminated || !pl.fleet) continue
    if (survivingShipCount(pl.fleet) === 0 && pl.fleet.ships.length > 0) {
      pl.eliminated = true
      state.lastMessage = `${pl.name} has been eliminated!`
      state.log.push(state.lastMessage)
    }
  }
}

export function applyBattleFleetMove(
  state: BattleFleetState,
  move: BattleFleetMove,
): { ok: true; state: BattleFleetState } | { ok: false; error: string } {
  const next = cloneBattleFleet(state)

  if (move.type === 'placeShip') {
    if (next.phase !== 'placement') return { ok: false, error: 'Not in placement.' }
    const got = getMutableFleet(next, move.playerId)
    if ('error' in got) return { ok: false, error: got.error }
    if (got.fleet.confirmed) return { ok: false, error: 'Fleet already confirmed.' }
    const terr = territoryForPlayer(next, move.playerId)
    if (!terr) return { ok: false, error: 'No territory.' }
    const res = placeShip(
      got.fleet,
      move.kind,
      move.x,
      move.y,
      move.orientation,
      terr,
    )
    if (!res.ok) return res
    setFleetForSide(next, got.sideId, res.fleet)
    return { ok: true, state: next }
  }

  if (move.type === 'removeShip') {
    if (next.phase !== 'placement') return { ok: false, error: 'Not in placement.' }
    const got = getMutableFleet(next, move.playerId)
    if ('error' in got) return { ok: false, error: got.error }
    const res = removeShip(got.fleet, move.kind)
    if (!res.ok) return res
    setFleetForSide(next, got.sideId, res.fleet)
    return { ok: true, state: next }
  }

  if (move.type === 'randomPlace') {
    if (next.phase !== 'placement') return { ok: false, error: 'Not in placement.' }
    const got = getMutableFleet(next, move.playerId)
    if ('error' in got) return { ok: false, error: got.error }
    if (got.fleet.confirmed) return { ok: false, error: 'Fleet already confirmed.' }
    const terr = territoryForPlayer(next, move.playerId)
    if (!terr) return { ok: false, error: 'No territory.' }
    const fleet = randomPlaceFleet(
      terr,
      next.seed + move.playerId.charCodeAt(1) * 97 + next.players.length,
    )
    setFleetForSide(next, got.sideId, fleet)
    return { ok: true, state: next }
  }

  if (move.type === 'confirmFleet') {
    if (next.phase !== 'placement') return { ok: false, error: 'Not in placement.' }
    const got = getMutableFleet(next, move.playerId)
    if ('error' in got) return { ok: false, error: got.error }
    if (!isFleetComplete(got.fleet)) {
      return { ok: false, error: 'Place all five ships first.' }
    }
    setFleetForSide(next, got.sideId, { ...got.fleet, confirmed: true })
    next.lastMessage = `${playerName(next, move.playerId)} confirmed fleet.`
    next.log.push(next.lastMessage)
    if (allSidesConfirmed(next)) beginBattle(next)
    return { ok: true, state: next }
  }

  if (move.type === 'unconfirmFleet') {
    if (next.phase !== 'placement') return { ok: false, error: 'Not in placement.' }
    const got = getMutableFleet(next, move.playerId)
    if ('error' in got) return { ok: false, error: got.error }
    setFleetForSide(next, got.sideId, { ...got.fleet, confirmed: false })
    return { ok: true, state: next }
  }

  if (move.type === 'fire') {
    if (next.phase !== 'battle') return { ok: false, error: 'Not in battle.' }
    if (next.turnPlayerId !== move.playerId) {
      return { ok: false, error: 'Not your turn.' }
    }
    if (!inBoard(move.x, move.y)) return { ok: false, error: 'Out of bounds.' }
    if (alreadyShot(next, move.x, move.y)) {
      return { ok: false, error: 'Already attacked that cell.' }
    }
    const tgt = targetSideForCell(next, move.playerId, move.x, move.y)
    if (!tgt.ok) return tgt

    const fleet = fleetForSide(next, tgt.sideId)
    if (!fleet) return { ok: false, error: 'No target fleet.' }

    const hitRes = applyHit(fleet, move.x, move.y)
    setFleetForSide(next, tgt.sideId, hitRes.fleet)

    const attacker = next.players.find((p) => p.id === move.playerId)!
    attacker.attacks += 1

    const shot: Shot = {
      byPlayerId: move.playerId,
      x: move.x,
      y: move.y,
      result: hitRes.result === 'miss' ? 'miss' : hitRes.result === 'sunk' ? 'sunk' : 'hit',
      sunkKind: hitRes.sunkKind,
      targetSideId: tgt.sideId,
    }
    next.shots.push(shot)

    if (hitRes.result === 'miss') {
      attacker.misses += 1
      next.lastMessage = `${attacker.name} missed.`
    } else {
      attacker.hits += 1
      attacker.score += HIT_POINTS
      if (hitRes.result === 'sunk' && hitRes.sunkKind) {
        attacker.shipsSunk += 1
        attacker.score += SINK_BONUS
        const kindLabel = hitRes.sunkKind.toUpperCase()
        if (next.config.mode === 'teams') {
          next.lastMessage = `${attacker.name} sank Team ${tgt.sideId}'s ${kindLabel}!`
        } else {
          const victim = next.players.find((p) => p.id === tgt.sideId)?.name ?? tgt.sideId
          next.lastMessage = `${attacker.name} sank ${victim}'s ${kindLabel}!`
        }
      } else {
        next.lastMessage = `${attacker.name} hit!`
      }
    }
    next.log.push(next.lastMessage)

    markEliminations(next)
    checkVictory(next)
    if (next.phase === 'battle') advanceTurn(next)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move.' }
}

/** Auto-confirm empty sides that somehow need fleets — used by bots. */
export function ensureFleet(state: BattleFleetState, playerId: string): BattleFleetState {
  const next = cloneBattleFleet(state)
  const got = getMutableFleet(next, playerId)
  if ('error' in got) return next
  if (got.fleet.ships.length === 0) {
    const terr = territoryForPlayer(next, playerId)
    if (terr) {
      setFleetForSide(next, got.sideId, randomPlaceFleet(terr, next.seed + 33))
    }
  }
  return next
}

/**
 * Human left mid-match: computer takes their seat (fleet intact).
 * Team fleets are never removed because one teammate disconnected.
 */
export function markBattleFleetDeparture(
  state: BattleFleetState,
  playerId: string,
): BattleFleetState {
  const next = cloneBattleFleet(state)
  const pl = next.players.find((p) => p.id === playerId)
  if (!pl || pl.isComputer || pl.eliminated) return next
  const label = pl.name
  pl.isComputer = true
  if (!/\(AI\)$/i.test(pl.name)) pl.name = `${pl.name} (AI)`
  next.lastMessage = `${label} left — computer takes over.`
  next.log.push(next.lastMessage)
  return next
}

export function resetFleets(state: BattleFleetState): BattleFleetState {
  const next = cloneBattleFleet(state)
  if (next.config.mode === 'teams') {
    for (const t of next.teams ?? []) t.fleet = emptyFleet()
  } else {
    for (const p of next.players) p.fleet = emptyFleet()
  }
  next.phase = 'placement'
  next.shots = []
  next.winnerId = null
  next.winnerTeamId = null
  next.turnPlayerId = null
  for (const p of next.players) {
    p.eliminated = false
    p.attacks = 0
    p.hits = 0
    p.misses = 0
    p.shipsSunk = 0
    p.score = 0
  }
  for (const t of next.teams ?? []) t.eliminated = false
  next.lastMessage = 'Place your fleets.'
  return next
}

export function shotKeySet(state: BattleFleetState): Set<string> {
  return new Set(state.shots.map((s) => cellKey(s.x, s.y)))
}
