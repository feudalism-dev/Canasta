import type { Cell, Orientation, ShipKind } from '../core/battlefleet/types'

const BF_ASSET = `${import.meta.env.BASE_URL}assets/battlefleet`

function shipSrc(name: string): string {
  return `${BF_ASSET}/ships/${name}.png`
}

export const BF_SHIP_SRC: Record<ShipKind, { intact: string; sunk: string }> = {
  carrier: {
    intact: shipSrc('carrier'),
    sunk: shipSrc('carrier-sunk'),
  },
  battleship: {
    intact: shipSrc('battleship'),
    sunk: shipSrc('battleship-sunk'),
  },
  cruiser: {
    intact: shipSrc('cruiser'),
    sunk: shipSrc('cruiser-sunk'),
  },
  submarine: {
    intact: shipSrc('submarine'),
    sunk: shipSrc('submarine-sunk'),
  },
  destroyer: {
    intact: shipSrc('destroyer'),
    sunk: shipSrc('destroyer-sunk'),
  },
}

/** Transient combat FX + persistent cell markers from the naval asset sheet. */
export const BF_FX = {
  /** Brief hit flash */
  explosion: `${BF_ASSET}/effects/explosion.png`,
  /** Brief miss splash */
  splash: `${BF_ASSET}/effects/splash.png`,
  /** Persistent miss marker (concentric ripples) */
  ripple: `${BF_ASSET}/effects/water-ripple.png`,
  /** Persistent hit marker (smoke) */
  smoke: `${BF_ASSET}/effects/smoke.png`,
} as const

export const BF_CHROME = {
  compass: `${BF_ASSET}/chrome/compass.png`,
  radar: `${BF_ASSET}/chrome/radar.png`,
  anchor: `${BF_ASSET}/chrome/anchor.png`,
  corner: `${BF_ASSET}/chrome/metal-corner.png`,
  divider: `${BF_ASSET}/chrome/metal-divider.png`,
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
