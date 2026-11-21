/** Battle Fleet — multiplayer Battleship variant for the Parlor table. */

export type BattleFleetMode = 'ffa' | 'teams'

export type BattleFleetDifficulty = 'easy' | 'normal' | 'hard'

export type BattleFleetPhase =
  | 'setup'
  | 'placement'
  | 'battle'
  | 'gameEnd'

export type ShipKind =
  | 'carrier'
  | 'battleship'
  | 'cruiser'
  | 'submarine'
  | 'destroyer'

export type Orientation = 'H' | 'V'

/** Global board cell: columns A–T (0–19), rows 1–20 (0–19). */
export type Cell = { x: number; y: number }

export type ShipDef = {
  kind: ShipKind
  length: number
  label: string
}

export type PlacedShip = {
  kind: ShipKind
  cells: Cell[]
  /** Cells already hit (subset of cells). */
  hits: Cell[]
  sunk: boolean
}

export type Fleet = {
  ships: PlacedShip[]
  confirmed: boolean
}

export type ShotResult = 'hit' | 'miss' | 'sunk'

export type Shot = {
  byPlayerId: string
  x: number
  y: number
  result: ShotResult
  /** If sunk, which ship kind. */
  sunkKind: ShipKind | null
  /** Owning side id that was attacked (player id or team id). */
  targetSideId: string
}

export type BattleFleetPlayer = {
  id: string
  name: string
  /** Physical table seat 0–3 when seated; -1 for unmapped computer. */
  seat: number
  isComputer: boolean
  /** Free-for-all: own fleet. Teams: unused (fleet lives on TeamSide). */
  fleet: Fleet | null
  eliminated: boolean
  attacks: number
  hits: number
  misses: number
  shipsSunk: number
  score: number
  /** Team id when mode === 'teams' (`A` | `B`). */
  teamId: 'A' | 'B' | null
}

export type TeamSide = {
  id: 'A' | 'B'
  /** Player ids on this team. */
  memberIds: string[]
  fleet: Fleet
  eliminated: boolean
}

export type BattleFleetConfig = {
  mode: BattleFleetMode
  playerCount: number
  difficulty: BattleFleetDifficulty
}

export type BattleFleetState = {
  config: BattleFleetConfig
  players: BattleFleetPlayer[]
  teams: TeamSide[] | null
  phase: BattleFleetPhase
  /** Whose logical turn (player id). */
  turnPlayerId: string | null
  /** Seat-order turn list of player ids (skips eliminated at runtime). */
  turnOrder: string[]
  shots: Shot[]
  /** Recent announcement for HUD / table. */
  lastMessage: string | null
  winnerId: string | null
  /** Team id when teams win. */
  winnerTeamId: 'A' | 'B' | null
  log: string[]
  seed: number
  /** Epoch ms when the match was created (for end-game duration). */
  startedAt: number
}

export type BattleFleetMove =
  | {
      type: 'placeShip'
      playerId: string
      kind: ShipKind
      x: number
      y: number
      orientation: Orientation
    }
  | { type: 'removeShip'; playerId: string; kind: ShipKind }
  | { type: 'randomPlace'; playerId: string }
  | { type: 'confirmFleet'; playerId: string }
  | { type: 'unconfirmFleet'; playerId: string }
  | { type: 'fire'; playerId: string; x: number; y: number }

export const SHIP_DEFS: ShipDef[] = [
  { kind: 'carrier', length: 5, label: 'Aircraft Carrier' },
  { kind: 'battleship', length: 4, label: 'Battleship' },
  { kind: 'cruiser', length: 3, label: 'Cruiser' },
  { kind: 'submarine', length: 3, label: 'Submarine' },
  { kind: 'destroyer', length: 2, label: 'Destroyer' },
]

export const BOARD_SIZE = 20
export const QUAD_SIZE = 10

export const HIT_POINTS = 10
export const SINK_BONUS = 20
export const WIN_BONUS = 50
