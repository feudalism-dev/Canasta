import { teamOfSeat } from '../variants'
import { ffaTerritory, teamTerritory } from './board'
import { emptyFleet } from './fleet'
import type {
  BattleFleetConfig,
  BattleFleetDifficulty,
  BattleFleetMode,
  BattleFleetPlayer,
  BattleFleetState,
  Fleet,
  TeamSide,
} from './types'

export function cloneBattleFleet(state: BattleFleetState): BattleFleetState {
  return structuredClone(state)
}

export function createBattleFleetMatch(
  names: string[],
  computers: boolean[],
  mode: BattleFleetMode = 'ffa',
  difficulty: BattleFleetDifficulty = 'normal',
  seed = Date.now(),
): BattleFleetState {
  const n = Math.max(2, Math.min(4, names.length))
  if (mode === 'teams' && n !== 4) {
    throw new Error('Team mode requires exactly 4 players')
  }

  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComp = computers.slice(0, n)
  while (useComp.length < n) useComp.push(true)

  const players: BattleFleetPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: Boolean(useComp[i]),
    fleet: mode === 'ffa' ? emptyFleet() : null,
    eliminated: false,
    attacks: 0,
    hits: 0,
    misses: 0,
    shipsSunk: 0,
    score: 0,
    teamId: mode === 'teams' ? (i < 2 ? 'A' : 'B') : null,
  }))

  let teams: TeamSide[] | null = null
  if (mode === 'teams') {
    teams = [
      {
        id: 'A',
        memberIds: [players[0]!.id, players[1]!.id],
        fleet: emptyFleet(),
        eliminated: false,
      },
      {
        id: 'B',
        memberIds: [players[2]!.id, players[3]!.id],
        fleet: emptyFleet(),
        eliminated: false,
      },
    ]
  }

  const config: BattleFleetConfig = { mode, playerCount: n, difficulty }

  // Random starting player among all
  const startIdx = Math.abs(seed) % n
  const turnOrder = players.map((p) => p.id)
  // Rotate so startIdx is first
  const rotated = [
    ...turnOrder.slice(startIdx),
    ...turnOrder.slice(0, startIdx),
  ]

  // Team mode: alternate teams A,B,A,B starting from startIdx's team preference
  let order = rotated
  if (mode === 'teams') {
    order = buildTeamTurnOrder(players, seed)
  }

  return {
    config,
    players,
    teams,
    phase: 'placement',
    turnPlayerId: null,
    turnOrder: order,
    shots: [],
    lastMessage: 'Place your fleets.',
    winnerId: null,
    winnerTeamId: null,
    log: ['Game started — place fleets.'],
    seed,
  }
}

/** A1, B1, A2, B2 alternating. */
function buildTeamTurnOrder(players: BattleFleetPlayer[], seed: number): string[] {
  const teamA = players.filter((p) => p.teamId === 'A')
  const teamB = players.filter((p) => p.teamId === 'B')
  const aFirst = seed % 2 === 0
  const first = aFirst ? teamA : teamB
  const second = aFirst ? teamB : teamA
  return [first[0]!.id, second[0]!.id, first[1]!.id, second[1]!.id]
}

export function withPhysicalSeats(
  state: BattleFleetState,
  seats: number[],
): BattleFleetState {
  const next = cloneBattleFleet(state)
  for (let i = 0; i < next.players.length; i++) {
    next.players[i]!.seat = seats[i] ?? i
  }
  if (next.config.mode === 'teams') {
    return assignBattleFleetTeamsBySeat(next)
  }
  return next
}

/**
 * Map parlor opposite-seat partners onto Team A/B (A = even seats, B = odd).
 * Preserves each team's fleet when reassigning membership.
 */
export function assignBattleFleetTeamsBySeat(
  state: BattleFleetState,
): BattleFleetState {
  if (state.config.mode !== 'teams') return state
  const next = cloneBattleFleet(state)
  const fleetByOld: Record<string, Fleet> = {}
  for (const t of next.teams ?? []) fleetByOld[t.id] = t.fleet

  for (const p of next.players) {
    p.teamId = teamOfSeat(p.seat) === 0 ? 'A' : 'B'
  }
  const aIds = next.players.filter((p) => p.teamId === 'A').map((p) => p.id)
  const bIds = next.players.filter((p) => p.teamId === 'B').map((p) => p.id)
  next.teams = [
    {
      id: 'A',
      memberIds: aIds,
      fleet: fleetByOld.A ?? emptyFleet(),
      eliminated: false,
    },
    {
      id: 'B',
      memberIds: bIds,
      fleet: fleetByOld.B ?? emptyFleet(),
      eliminated: false,
    },
  ]
  next.turnOrder = buildTeamTurnOrder(next.players, next.seed)
  return next
}

export function territoryForPlayer(
  state: BattleFleetState,
  playerId: string,
): { x0: number; y0: number; width: number; height: number } | null {
  const pl = state.players.find((p) => p.id === playerId)
  if (!pl) return null
  const idx = state.players.indexOf(pl)
  if (state.config.mode === 'teams' && pl.teamId) {
    return teamTerritory(pl.teamId)
  }
  return ffaTerritory(idx, state.config.playerCount)
}

export function fleetForSide(
  state: BattleFleetState,
  sideId: string,
): import('./types').Fleet | null {
  if (state.config.mode === 'teams') {
    return state.teams?.find((t) => t.id === sideId)?.fleet ?? null
  }
  return state.players.find((p) => p.id === sideId)?.fleet ?? null
}

export function sideIdForPlayer(
  state: BattleFleetState,
  playerId: string,
): string | null {
  const pl = state.players.find((p) => p.id === playerId)
  if (!pl) return null
  if (state.config.mode === 'teams') return pl.teamId
  return pl.id
}
