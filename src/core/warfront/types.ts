/** Warfront — theater command parlor family (land / sea). */

export type WarfrontTheater = 'land' | 'sea'

export type WarfrontAlign = 'ffa' | 'teams'

export type WarfrontDifficulty = 'easy' | 'normal' | 'hard'

export type WarfrontPhase =
  | 'income'
  | 'buy'
  | 'ranged'
  | 'move'
  | 'gameEnd'

export type LandUnit = 'infantry' | 'antitank' | 'tank' | 'artillery'
export type SeaUnit = 'escort' | 'sub' | 'capital' | 'carrier'
export type WarfrontUnit = LandUnit | SeaUnit

export type WarfrontConfig = {
  theater: WarfrontTheater
  align: WarfrontAlign
  playerCount: number
  difficulty: WarfrontDifficulty
}

export type UnitStack = Partial<Record<WarfrontUnit, number>>

export type ZoneState = {
  ownerId: string | null
  /** Facility present on this zone. */
  facility: boolean
  units: UnitStack
}

export type WarfrontPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  teamId: 'A' | 'B' | null
  pp: number
  vp: number
  eliminated: boolean
  /** Home facility zone id. */
  homeZoneId: number
}

export type WarfrontState = {
  config: WarfrontConfig
  players: WarfrontPlayer[]
  zones: ZoneState[]
  /** Adjacency: zoneId → neighbor zone ids. */
  adj: number[][]
  /** Layout coords for rendering (0–1 normalized). */
  layout: { x: number; y: number }[]
  phase: WarfrontPhase
  turnPlayerId: string | null
  turnOrder: string[]
  /** Within buy phase: pending purchases not yet placed are applied immediately in v1. */
  rangedUsed: boolean
  moved: boolean
  lastMessage: string | null
  winnerId: string | null
  winnerTeamId: 'A' | 'B' | null
  log: string[]
  seed: number
  round: number
}

export type WarfrontMove =
  | { type: 'buy'; playerId: string; unit: WarfrontUnit; zoneId: number; count?: number }
  | { type: 'skipBuy'; playerId: string }
  | {
      type: 'ranged'
      playerId: string
      fromZoneId: number
      toZoneId: number
    }
  | { type: 'skipRanged'; playerId: string }
  | {
      type: 'move'
      playerId: string
      fromZoneId: number
      toZoneId: number
      units: UnitStack
    }
  | { type: 'skipMove'; playerId: string }
  | { type: 'endTurn'; playerId: string }

export type UnitDef = {
  unit: WarfrontUnit
  label: string
  cost: number
  atk: number
  def: number
  /** Can flip / hold a zone after combat. */
  canOccupy: boolean
  /** Provides ranged strike. */
  ranged: boolean
  theater: WarfrontTheater
}

export const STACK_CAP = 8
export const VP_TO_WIN = 12
export const COMBAT_MAX_ROUNDS = 6

export const LAND_UNITS: UnitDef[] = [
  { unit: 'infantry', label: 'Infantry', cost: 3, atk: 1, def: 2, canOccupy: true, ranged: false, theater: 'land' },
  { unit: 'antitank', label: 'Anti-tank', cost: 4, atk: 2, def: 1, canOccupy: true, ranged: false, theater: 'land' },
  { unit: 'tank', label: 'Tank', cost: 6, atk: 3, def: 2, canOccupy: true, ranged: false, theater: 'land' },
  { unit: 'artillery', label: 'Artillery', cost: 5, atk: 0, def: 1, canOccupy: false, ranged: true, theater: 'land' },
]

export const SEA_UNITS: UnitDef[] = [
  { unit: 'escort', label: 'Escort', cost: 3, atk: 1, def: 2, canOccupy: true, ranged: false, theater: 'sea' },
  { unit: 'sub', label: 'Sub', cost: 5, atk: 2, def: 1, canOccupy: false, ranged: false, theater: 'sea' },
  { unit: 'capital', label: 'Capital', cost: 8, atk: 3, def: 3, canOccupy: true, ranged: false, theater: 'sea' },
  { unit: 'carrier', label: 'Carrier', cost: 7, atk: 0, def: 2, canOccupy: false, ranged: true, theater: 'sea' },
]

export function unitCatalog(theater: WarfrontTheater): UnitDef[] {
  return theater === 'sea' ? SEA_UNITS : LAND_UNITS
}

export function unitDef(unit: WarfrontUnit): UnitDef | undefined {
  return [...LAND_UNITS, ...SEA_UNITS].find((d) => d.unit === unit)
}
