import { cellInRect, cellKey, inBoard } from './board'
import {
  SHIP_DEFS,
  type Cell,
  type Fleet,
  type Orientation,
  type PlacedShip,
  type ShipKind,
} from './types'

export function emptyFleet(): Fleet {
  return { ships: [], confirmed: false }
}

export function shipCells(
  x: number,
  y: number,
  length: number,
  orientation: Orientation,
): Cell[] {
  const cells: Cell[] = []
  for (let i = 0; i < length; i++) {
    cells.push(orientation === 'H' ? { x: x + i, y } : { x, y: y + i })
  }
  return cells
}

export function shipDef(kind: ShipKind) {
  return SHIP_DEFS.find((s) => s.kind === kind)!
}

function occupiedSet(fleet: Fleet, exceptKind?: ShipKind): Set<string> {
  const set = new Set<string>()
  for (const s of fleet.ships) {
    if (exceptKind && s.kind === exceptKind) continue
    for (const c of s.cells) set.add(cellKey(c.x, c.y))
  }
  return set
}

export function validatePlacement(
  fleet: Fleet,
  kind: ShipKind,
  x: number,
  y: number,
  orientation: Orientation,
  territory: { x0: number; y0: number; width: number; height: number },
): { ok: true; cells: Cell[] } | { ok: false; error: string } {
  const def = shipDef(kind)
  const cells = shipCells(x, y, def.length, orientation)
  for (const c of cells) {
    if (!inBoard(c.x, c.y)) {
      return { ok: false, error: 'Ship extends outside the board.' }
    }
    if (!cellInRect(c.x, c.y, territory)) {
      return { ok: false, error: 'Ship extends outside your territory.' }
    }
  }
  const occ = occupiedSet(fleet, kind)
  for (const c of cells) {
    if (occ.has(cellKey(c.x, c.y))) {
      return { ok: false, error: 'Ships cannot overlap.' }
    }
  }
  return { ok: true, cells }
}

export function placeShip(
  fleet: Fleet,
  kind: ShipKind,
  x: number,
  y: number,
  orientation: Orientation,
  territory: { x0: number; y0: number; width: number; height: number },
): { ok: true; fleet: Fleet } | { ok: false; error: string } {
  if (fleet.confirmed) return { ok: false, error: 'Fleet is locked.' }
  const v = validatePlacement(fleet, kind, x, y, orientation, territory)
  if (!v.ok) return v
  const ships = fleet.ships.filter((s) => s.kind !== kind)
  ships.push({ kind, cells: v.cells, hits: [], sunk: false })
  return { ok: true, fleet: { ships, confirmed: false } }
}

export function removeShip(
  fleet: Fleet,
  kind: ShipKind,
): { ok: true; fleet: Fleet } | { ok: false; error: string } {
  if (fleet.confirmed) return { ok: false, error: 'Fleet is locked.' }
  return {
    ok: true,
    fleet: { ships: fleet.ships.filter((s) => s.kind !== kind), confirmed: false },
  }
}

export function isFleetComplete(fleet: Fleet): boolean {
  if (fleet.ships.length !== SHIP_DEFS.length) return false
  const kinds = new Set(fleet.ships.map((s) => s.kind))
  return SHIP_DEFS.every((d) => kinds.has(d.kind))
}

export function remainingCells(fleet: Fleet): number {
  let n = 0
  for (const s of fleet.ships) {
    if (s.sunk) continue
    n += s.cells.length - s.hits.length
  }
  return n
}

export function survivingShipCount(fleet: Fleet): number {
  return fleet.ships.filter((s) => !s.sunk).length
}

/** Seeded mulberry32 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomPlaceFleet(
  territory: { x0: number; y0: number; width: number; height: number },
  seed: number,
): Fleet {
  const rng = createRng(seed)
  let fleet = emptyFleet()
  // Place largest first
  const order = [...SHIP_DEFS].sort((a, b) => b.length - a.length)
  for (const def of order) {
    let placed = false
    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      const orientation: Orientation = rng() < 0.5 ? 'H' : 'V'
      const maxX =
        territory.x0 +
        territory.width -
        (orientation === 'H' ? def.length : 1)
      const maxY =
        territory.y0 +
        territory.height -
        (orientation === 'V' ? def.length : 1)
      if (maxX < territory.x0 || maxY < territory.y0) continue
      const x = territory.x0 + Math.floor(rng() * (maxX - territory.x0 + 1))
      const y = territory.y0 + Math.floor(rng() * (maxY - territory.y0 + 1))
      const res = placeShip(fleet, def.kind, x, y, orientation, territory)
      if (res.ok) {
        fleet = res.fleet
        placed = true
      }
    }
    if (!placed) {
      // Restart whole fleet if stuck
      return randomPlaceFleet(territory, seed + 7919)
    }
  }
  return fleet
}

export function cellHasShip(fleet: Fleet, x: number, y: number): PlacedShip | null {
  const k = cellKey(x, y)
  for (const s of fleet.ships) {
    if (s.cells.some((c) => cellKey(c.x, c.y) === k)) return s
  }
  return null
}

export function applyHit(
  fleet: Fleet,
  x: number,
  y: number,
): {
  fleet: Fleet
  result: 'hit' | 'miss' | 'sunk'
  sunkKind: ShipKind | null
} {
  const ship = cellHasShip(fleet, x, y)
  if (!ship) {
    return { fleet, result: 'miss', sunkKind: null }
  }
  const hitKey = cellKey(x, y)
  if (ship.hits.some((h) => cellKey(h.x, h.y) === hitKey)) {
    // Already hit — treat as miss for scoring; caller should reject repeats first
    return { fleet, result: 'miss', sunkKind: null }
  }
  const ships = fleet.ships.map((s) => {
    if (s.kind !== ship.kind) return s
    const hits = [...s.hits, { x, y }]
    const sunk = hits.length >= s.cells.length
    return { ...s, hits, sunk }
  })
  const updated = ships.find((s) => s.kind === ship.kind)!
  return {
    fleet: { ...fleet, ships },
    result: updated.sunk ? 'sunk' : 'hit',
    sunkKind: updated.sunk ? updated.kind : null,
  }
}
