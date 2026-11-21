import { ownerIndexAt, teamIdAt, cellKey } from '../core/battlefleet/board'
import type {
  BattleFleetMode,
  Fleet,
  Orientation,
  ShipKind,
} from '../core/battlefleet/types'
import { BOARD_SIZE, SHIP_DEFS } from '../core/battlefleet/types'

/** CSS identity token for FFA seat index or team. */
export function bfIdentityClass(
  mode: BattleFleetMode,
  opts: { seat?: number; teamId?: 'A' | 'B' | null; sideId?: string },
): string {
  if (mode === 'teams') {
    const t =
      opts.teamId ||
      (opts.sideId === 'A' || opts.sideId === 'B' ? opts.sideId : null)
    if (t === 'A') return 'bf-id-team-a'
    if (t === 'B') return 'bf-id-team-b'
    return ''
  }
  if (opts.seat != null && opts.seat >= 0 && opts.seat < 4) {
    return `bf-id-seat-${opts.seat}`
  }
  return ''
}

/** Territory wash class for a cell, or '' if inactive / no owner. */
export function bfTerritoryClass(
  mode: BattleFleetMode,
  playerCount: number,
  x: number,
  y: number,
  players?: { id: string; seat: number; teamId: 'A' | 'B' | null }[],
): string {
  if (mode === 'teams') {
    const t = teamIdAt(x, y)
    return t ? bfIdentityClass('teams', { teamId: t }) : ''
  }
  const idx = ownerIndexAt(x, y, playerCount)
  if (idx < 0) return ''
  const seat = players?.[idx]?.seat ?? idx
  return bfIdentityClass('ffa', { seat })
}

export function bfSeaActive(
  mode: BattleFleetMode,
  playerCount: number,
  x: number,
  y: number,
): boolean {
  if (mode === 'teams') return true
  return ownerIndexAt(x, y, playerCount) >= 0
}

export function colLabels(): string[] {
  return Array.from({ length: BOARD_SIZE }, (_, i) => String.fromCharCode(65 + i))
}

export function rowLabels(): string[] {
  return Array.from({ length: BOARD_SIZE }, (_, i) => String(i + 1))
}

export type ShipSegInfo = {
  kind: ShipKind
  seg: number
  len: number
  orient: Orientation
  role: 'bow' | 'mid' | 'stern'
  sunk: boolean
}

/** Map own-fleet cells → silhouette segment metadata for grid rendering. */
export function buildOwnShipSegMap(fleet: Fleet | null | undefined): Map<string, ShipSegInfo> {
  const m = new Map<string, ShipSegInfo>()
  if (!fleet) return m
  for (const ship of fleet.ships) {
    if (!ship.cells.length) continue
    const a = ship.cells[0]!
    const b = ship.cells[ship.cells.length - 1]!
    const orient: Orientation = a.y === b.y ? 'H' : 'V'
    const ordered = [...ship.cells].sort((c1, c2) =>
      orient === 'H' ? c1.x - c2.x || c1.y - c2.y : c1.y - c2.y || c1.x - c2.x,
    )
    const len = ordered.length
    ordered.forEach((c, i) => {
      const role: ShipSegInfo['role'] =
        i === 0 ? 'bow' : i === len - 1 ? 'stern' : 'mid'
      m.set(cellKey(c.x, c.y), {
        kind: ship.kind,
        seg: i,
        len,
        orient,
        role,
        sunk: ship.sunk,
      })
    })
  }
  return m
}

/** Preview segment map for a ghost placement. */
export function buildPreviewSegMap(
  x: number,
  y: number,
  kind: ShipKind,
  orientation: Orientation,
): Map<string, ShipSegInfo> {
  const def = SHIP_DEFS.find((d) => d.kind === kind)
  const len = def?.length ?? 3
  const m = new Map<string, ShipSegInfo>()
  for (let i = 0; i < len; i++) {
    const cx = orientation === 'H' ? x + i : x
    const cy = orientation === 'V' ? y + i : y
    const role: ShipSegInfo['role'] = i === 0 ? 'bow' : i === len - 1 ? 'stern' : 'mid'
    m.set(cellKey(cx, cy), {
      kind,
      seg: i,
      len,
      orient: orientation,
      role,
      sunk: false,
    })
  }
  return m
}

export function shipSegClass(seg: ShipSegInfo | undefined, preview = false): string {
  if (!seg) return ''
  return [
    preview ? 'ship-ghost' : 'ship-hull',
    `ship-${seg.kind}`,
    `ship-${seg.orient === 'H' ? 'h' : 'v'}`,
    `ship-${seg.role}`,
    seg.sunk ? 'ship-wreck' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Tiny SVG silhouette for ship kind buttons. */
export function ShipKindIcon({ kind }: { kind: ShipKind }) {
  const len = SHIP_DEFS.find((d) => d.kind === kind)?.length ?? 3
  const w = 12 + len * 5
  const h = 12
  return (
    <svg
      className="bf-ship-icon"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <path
        d={`M2 6 L${w * 0.22} 3.2 H${w - 3} L${w - 1} 6 L${w - 3} 8.8 H${w * 0.22} Z`}
        fill="currentColor"
        opacity="0.92"
      />
      {kind === 'carrier' ? (
        <rect x={w * 0.38} y="1.5" width={w * 0.28} height="1.8" rx="0.4" fill="currentColor" opacity="0.55" />
      ) : null}
      {kind === 'battleship' ? (
        <>
          <rect x={w * 0.4} y="2" width="2.2" height="1.6" fill="currentColor" opacity="0.55" />
          <rect x={w * 0.55} y="2" width="2.2" height="1.6" fill="currentColor" opacity="0.55" />
        </>
      ) : null}
      {kind === 'submarine' ? (
        <circle cx={w - 4} cy="6" r="1.6" fill="currentColor" opacity="0.75" />
      ) : null}
      {kind === 'destroyer' ? (
        <path d={`M${w * 0.35} 6 L${w * 0.5} 2.5 L${w * 0.55} 6`} fill="currentColor" opacity="0.5" />
      ) : null}
    </svg>
  )
}

export function BattleFleetLegend() {
  return (
    <div className="bf-legend" aria-label="Board legend">
      <span className="bf-legend-item">
        <i className="bf-swatch water" /> Water
      </span>
      <span className="bf-legend-item">
        <i className="bf-swatch own" /> Fleet
      </span>
      <span className="bf-legend-item">
        <i className="bf-swatch miss" /> Miss
      </span>
      <span className="bf-legend-item">
        <i className="bf-swatch hit" /> Hit
      </span>
      <span className="bf-legend-item">
        <i className="bf-swatch sunk" /> Sunk
      </span>
    </div>
  )
}
