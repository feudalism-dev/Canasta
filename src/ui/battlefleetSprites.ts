import type { Cell, Orientation, ShipKind } from '../core/battlefleet/types'

export const BF_SHIP_SRC: Record<ShipKind, { intact: string; sunk: string }> = {
  carrier: {
    intact: '/assets/battlefleet/ships/carrier.png',
    sunk: '/assets/battlefleet/ships/carrier-sunk.png',
  },
  battleship: {
    intact: '/assets/battlefleet/ships/battleship.png',
    sunk: '/assets/battlefleet/ships/battleship-sunk.png',
  },
  cruiser: {
    intact: '/assets/battlefleet/ships/cruiser.png',
    sunk: '/assets/battlefleet/ships/cruiser-sunk.png',
  },
  submarine: {
    intact: '/assets/battlefleet/ships/submarine.png',
    sunk: '/assets/battlefleet/ships/submarine-sunk.png',
  },
  destroyer: {
    intact: '/assets/battlefleet/ships/destroyer.png',
    sunk: '/assets/battlefleet/ships/destroyer-sunk.png',
  },
}

export const BF_FX = {
  explosion: '/assets/battlefleet/effects/explosion.png',
  ripple: '/assets/battlefleet/effects/water-ripple.png',
} as const

export const BF_CHROME = {
  compass: '/assets/battlefleet/chrome/compass.png',
  radar: '/assets/battlefleet/chrome/radar.png',
  anchor: '/assets/battlefleet/chrome/anchor.png',
  corner: '/assets/battlefleet/chrome/metal-corner.png',
  divider: '/assets/battlefleet/chrome/metal-divider.png',
} as const

export type BfSpriteShip = {
  key: string
  kind: ShipKind
  cells: Cell[]
  orient: Orientation
  sunk: boolean
  ghost?: boolean
}

/** Derive orientation from cells; bow is the first cell in sorted order. */
export function orientFromCells(cells: Cell[]): Orientation {
  if (cells.length < 2) return 'V'
  const a = cells[0]!
  const b = cells[cells.length - 1]!
  return a.y === b.y ? 'H' : 'V'
}

export function sortedShipCells(cells: Cell[], orient: Orientation): Cell[] {
  return [...cells].sort((c1, c2) =>
    orient === 'H' ? c1.x - c2.x || c1.y - c2.y : c1.y - c2.y || c1.x - c2.x,
  )
}

export function shipFootprint(cells: Cell[]): {
  x0: number
  y0: number
  w: number
  h: number
  orient: Orientation
} {
  const orient = orientFromCells(cells)
  const ordered = sortedShipCells(cells, orient)
  const x0 = Math.min(...ordered.map((c) => c.x))
  const y0 = Math.min(...ordered.map((c) => c.y))
  const x1 = Math.max(...ordered.map((c) => c.x))
  const y1 = Math.max(...ordered.map((c) => c.y))
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, orient }
}
