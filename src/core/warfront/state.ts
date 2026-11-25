import { teamOfSeat } from '../variants'
import { buildCrossroadsMap } from './map'
import { emptyStack } from './stacks'
import {
  VP_TO_WIN,
  type UnitStack,
  type WarfrontAlign,
  type WarfrontConfig,
  type WarfrontDifficulty,
  type WarfrontPlayer,
  type WarfrontState,
  type WarfrontTheater,
  type ZoneState,
} from './types'

export function cloneWarfront(state: WarfrontState): WarfrontState {
  return structuredClone(state)
}

function landStartHome(): UnitStack {
  return { infantry: 4, tank: 1, artillery: 1 }
}

function landStartSat(): UnitStack {
  return { infantry: 2 }
}

function seaStartHome(): UnitStack {
  return { escort: 3, capital: 1, carrier: 1 }
}

function seaStartSat(): UnitStack {
  return { escort: 2 }
}

export function createWarfrontMatch(
  names: string[],
  computers: boolean[],
  theater: WarfrontTheater = 'land',
  align: WarfrontAlign = 'ffa',
  difficulty: WarfrontDifficulty = 'normal',
  seed = Date.now(),
): WarfrontState {
  const n = align === 'teams' ? 4 : Math.max(2, Math.min(4, names.length))
  if (align === 'teams' && n !== 4) {
    throw new Error('Team mode requires exactly 4 players')
  }

  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComp = computers.slice(0, n)
  while (useComp.length < n) useComp.push(true)

  const map = buildCrossroadsMap()
  const zones: ZoneState[] = Array.from({ length: map.zoneCount }, (_, i) => ({
    ownerId: null,
    facility: map.facilities.includes(i),
    units: emptyStack(),
  }))

  const players: WarfrontPlayer[] = useNames.map((name, i) => {
    const homeZones = map.homes[i]!
    return {
      id: `p${i}`,
      name,
      seat: i,
      isComputer: Boolean(useComp[i]),
      teamId: align === 'teams' ? (teamOfSeat(i) === 0 ? 'A' : 'B') : null,
      pp: 0,
      vp: 0,
      eliminated: false,
      homeZoneId: homeZones[0]!,
    }
  })

  const homeUnits = theater === 'sea' ? seaStartHome : landStartHome
  const satUnits = theater === 'sea' ? seaStartSat : landStartSat

  for (let i = 0; i < n; i++) {
    const pl = players[i]!
    const [home, satA, satB] = map.homes[i]!
    zones[home]!.ownerId = pl.id
    zones[home]!.units = homeUnits()
    zones[satA]!.ownerId = pl.id
    zones[satA]!.units = satUnits()
    zones[satB]!.ownerId = pl.id
    zones[satB]!.units = satUnits()
  }

  const startIdx = Math.abs(seed) % n
  let turnOrder = players.map((p) => p.id)
  turnOrder = [...turnOrder.slice(startIdx), ...turnOrder.slice(0, startIdx)]
  if (align === 'teams') {
    turnOrder = buildTeamTurnOrder(players, seed)
  }

  const first = turnOrder[0]!
  const config: WarfrontConfig = {
    theater,
    align,
    playerCount: n,
    difficulty,
  }

  const state: WarfrontState = {
    config,
    players,
    zones,
    adj: map.adj,
    layout: map.layout,
    phase: 'income',
    turnPlayerId: first,
    turnOrder,
    rangedUsed: false,
    moved: false,
    lastMessage: 'Warfront — income phase.',
    winnerId: null,
    winnerTeamId: null,
    log: ['Match started.'],
    seed,
    round: 1,
  }

  return applyIncome(state, first)
}

/** Apply income for the active player and move to buy phase. */
export function applyIncome(state: WarfrontState, playerId: string): WarfrontState {
  const next = cloneWarfront(state)
  const pl = next.players.find((p) => p.id === playerId)
  if (!pl || pl.eliminated) return next
  let gained = 0
  for (const z of next.zones) {
    if (z.ownerId === playerId && z.facility) {
      gained += 1
    }
  }
  pl.pp += gained
  pl.vp += gained
  next.phase = 'buy'
  next.rangedUsed = false
  next.moved = false
  next.lastMessage = `${pl.name} income +${gained} PP/VP (bank ${pl.pp} PP, ${pl.vp} VP).`
  next.log.push(next.lastMessage)
  return checkWin(next)
}

function buildTeamTurnOrder(players: WarfrontPlayer[], seed: number): string[] {
  const teamA = players.filter((p) => p.teamId === 'A')
  const teamB = players.filter((p) => p.teamId === 'B')
  const aFirst = seed % 2 === 0
  const first = aFirst ? teamA : teamB
  const second = aFirst ? teamB : teamA
  return [first[0]!.id, second[0]!.id, first[1]!.id, second[1]!.id]
}

export function withPhysicalSeats(
  state: WarfrontState,
  seats: number[],
): WarfrontState {
  const next = cloneWarfront(state)
  for (let i = 0; i < next.players.length; i++) {
    next.players[i]!.seat = seats[i] ?? i
  }
  if (next.config.align === 'teams') {
    for (const p of next.players) {
      p.teamId = teamOfSeat(p.seat) === 0 ? 'A' : 'B'
    }
    next.turnOrder = buildTeamTurnOrder(next.players, next.seed)
  }
  return next
}

export function playerById(
  state: WarfrontState,
  id: string | null,
): WarfrontPlayer | undefined {
  if (!id) return undefined
  return state.players.find((p) => p.id === id)
}

export function teamVp(state: WarfrontState, teamId: 'A' | 'B'): number {
  return state.players
    .filter((p) => p.teamId === teamId)
    .reduce((s, p) => s + p.vp, 0)
}

export function checkWin(state: WarfrontState): WarfrontState {
  if (state.phase === 'gameEnd') return state
  const next = state

  if (next.config.align === 'teams') {
    const vpA = teamVp(next, 'A')
    const vpB = teamVp(next, 'B')
    if (vpA >= VP_TO_WIN || vpB >= VP_TO_WIN) {
      next.phase = 'gameEnd'
      next.winnerTeamId = vpA >= vpB ? 'A' : 'B'
      next.winnerId = null
      next.turnPlayerId = null
      next.lastMessage = `Team ${next.winnerTeamId} wins by VP!`
      next.log.push(next.lastMessage)
      return next
    }
  } else {
    for (const p of next.players) {
      if (p.vp >= VP_TO_WIN) {
        next.phase = 'gameEnd'
        next.winnerId = p.id
        next.winnerTeamId = null
        next.turnPlayerId = null
        next.lastMessage = `${p.name} wins by VP!`
        next.log.push(next.lastMessage)
        return next
      }
    }
  }

  // Elimination: players with no zones and no units are eliminated
  for (const p of next.players) {
    if (p.eliminated) continue
    const zones = next.zones.filter((z) => z.ownerId === p.id)
    const unitsLeft = zones.some((z) => Object.values(z.units).some((n) => (n ?? 0) > 0))
    if (zones.length === 0 && !unitsLeft) {
      p.eliminated = true
    }
  }

  if (next.config.align === 'teams') {
    const aAlive = next.players.some((p) => p.teamId === 'A' && !p.eliminated)
    const bAlive = next.players.some((p) => p.teamId === 'B' && !p.eliminated)
    if (aAlive && !bAlive) {
      next.phase = 'gameEnd'
      next.winnerTeamId = 'A'
      next.lastMessage = 'Team A wins — Team B eliminated.'
      next.turnPlayerId = null
      next.log.push(next.lastMessage)
    } else if (bAlive && !aAlive) {
      next.phase = 'gameEnd'
      next.winnerTeamId = 'B'
      next.lastMessage = 'Team B wins — Team A eliminated.'
      next.turnPlayerId = null
      next.log.push(next.lastMessage)
    }
  } else {
    const alive = next.players.filter((p) => !p.eliminated)
    if (alive.length === 1) {
      next.phase = 'gameEnd'
      next.winnerId = alive[0]!.id
      next.lastMessage = `${alive[0]!.name} wins — last commander standing.`
      next.turnPlayerId = null
      next.log.push(next.lastMessage)
    }
  }
  return next
}

export function facilityLabel(theater: WarfrontTheater): string {
  return theater === 'sea' ? 'Port' : 'Depot'
}
