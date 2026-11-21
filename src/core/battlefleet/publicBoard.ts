import { cellKey } from './board'
import { remainingCells, survivingShipCount } from './fleet'
import { fleetForSide } from './state'
import type {
  BattleFleetPhase,
  BattleFleetState,
  Cell,
  ShipKind,
  Shot,
} from './types'

export type PublicCellMark = 'miss' | 'hit' | 'sunk'

export type BattleFleetPublicPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  teamId: 'A' | 'B' | null
  eliminated: boolean
  shipsLeft: number
  cellsLeft: number
  hits: number
  misses: number
  shipsSunk: number
  score: number
}

export type BattleFleetPublicSunkShip = {
  sideId: string
  kind: ShipKind
  cells: Cell[]
}

export type BattleFleetPublicBoard = {
  live: boolean
  mode: 'ffa' | 'teams'
  playerCount: number
  phase: BattleFleetPhase | 'idle'
  turnPlayerId: string | null
  turnName: string
  lastMessage: string
  players: BattleFleetPublicPlayer[]
  /** Global cell marks from public shots. */
  marks: { x: number; y: number; mark: PublicCellMark }[]
  sunkShips: BattleFleetPublicSunkShip[]
  winnerId: string | null
  winnerTeamId: 'A' | 'B' | null
  recentShot: Shot | null
}

function clip(raw: string, n: number): string {
  const s = raw.replace(/[|,&?#]/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : s.slice(0, n)
}

export function isBattleFleetBoardPayload(raw: string): boolean {
  const t = raw.trim()
  if (!t.startsWith('{')) return false
  try {
    const o = JSON.parse(t) as { mode?: string; marks?: unknown; players?: unknown }
    return (
      (o.mode === 'ffa' || o.mode === 'teams') &&
      Array.isArray(o.marks) &&
      Array.isArray(o.players)
    )
  } catch {
    return false
  }
}

export function decodeBattleFleetPublicBoard(raw: string): BattleFleetPublicBoard {
  try {
    return JSON.parse(raw) as BattleFleetPublicBoard
  } catch {
    return idleBattleFleetPublicBoard()
  }
}

export function idleBattleFleetPublicBoard(): BattleFleetPublicBoard {
  return {
    live: false,
    mode: 'ffa',
    playerCount: 0,
    phase: 'idle',
    turnPlayerId: null,
    turnName: '',
    lastMessage: '',
    players: [],
    marks: [],
    sunkShips: [],
    winnerId: null,
    winnerTeamId: null,
    recentShot: null,
  }
}

export function battleFleetPublicBoardFromState(
  state: BattleFleetState,
): BattleFleetPublicBoard {
  const players: BattleFleetPublicPlayer[] = state.players.map((p) => {
    const sideId =
      state.config.mode === 'teams' && p.teamId ? p.teamId : p.id
    const fleet = fleetForSide(state, sideId)
    return {
      id: p.id,
      name: clip(p.name, 16),
      seat: p.seat,
      isComputer: p.isComputer,
      teamId: p.teamId,
      eliminated: p.eliminated,
      shipsLeft: fleet ? survivingShipCount(fleet) : 0,
      cellsLeft: fleet ? remainingCells(fleet) : 0,
      hits: p.hits,
      misses: p.misses,
      shipsSunk: p.shipsSunk,
      score: p.score,
    }
  })

  const marks: BattleFleetPublicBoard['marks'] = []
  const seen = new Set<string>()
  for (const s of state.shots) {
    const k = cellKey(s.x, s.y)
    if (seen.has(k)) continue
    seen.add(k)
    const mark: PublicCellMark =
      s.result === 'miss' ? 'miss' : s.result === 'sunk' ? 'sunk' : 'hit'
    marks.push({ x: s.x, y: s.y, mark })
  }
  // Upgrade hit cells that belong to sunk ships to sunk
  const sunkShips: BattleFleetPublicSunkShip[] = []
  const sides =
    state.config.mode === 'teams'
      ? (state.teams ?? []).map((t) => t.id)
      : state.players.map((p) => p.id)
  for (const sideId of sides) {
    const fleet = fleetForSide(state, sideId)
    if (!fleet) continue
    for (const ship of fleet.ships) {
      if (!ship.sunk) continue
      sunkShips.push({ sideId, kind: ship.kind, cells: ship.cells })
      for (const c of ship.cells) {
        const m = marks.find((x) => x.x === c.x && x.y === c.y)
        if (m) m.mark = 'sunk'
        else marks.push({ x: c.x, y: c.y, mark: 'sunk' })
      }
    }
  }

  const turn = state.players.find((p) => p.id === state.turnPlayerId)

  return {
    live: state.phase !== 'gameEnd',
    mode: state.config.mode,
    playerCount: state.config.playerCount,
    phase: state.phase,
    turnPlayerId: state.turnPlayerId,
    turnName: turn ? clip(turn.name, 16) : '',
    lastMessage: clip(state.lastMessage ?? '', 72),
    players,
    marks,
    sunkShips,
    winnerId: state.winnerId,
    winnerTeamId: state.winnerTeamId,
    recentShot: state.shots.length ? state.shots[state.shots.length - 1]! : null,
  }
}

/**
 * Private HUD view for one player: own (or team) fleet cells + public marks.
 */
export function battleFleetPrivateView(
  state: BattleFleetState,
  viewerId: string,
): {
  public: BattleFleetPublicBoard
  ownShipCells: Cell[]
  ownHits: Cell[]
} {
  const pub = battleFleetPublicBoardFromState(state)
  const pl = state.players.find((p) => p.id === viewerId)
  const sideId =
    state.config.mode === 'teams' && pl?.teamId ? pl.teamId : viewerId
  const fleet = fleetForSide(state, sideId)
  const ownShipCells: Cell[] = []
  const ownHits: Cell[] = []
  if (fleet) {
    for (const s of fleet.ships) {
      for (const c of s.cells) ownShipCells.push(c)
      for (const h of s.hits) ownHits.push(h)
    }
  }
  return { public: pub, ownShipCells, ownHits }
}
