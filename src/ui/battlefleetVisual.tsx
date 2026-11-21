import { ownerIndexAt, teamIdAt } from '../core/battlefleet/board'
import type { BattleFleetMode, ShipKind } from '../core/battlefleet/types'
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

/** Tiny SVG silhouette for ship kind buttons. */
export function ShipKindIcon({ kind }: { kind: ShipKind }) {
  const len = SHIP_DEFS.find((d) => d.kind === kind)?.length ?? 3
  const w = 10 + len * 4
  const h = 10
  return (
    <svg
      className="bf-ship-icon"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <rect
        x="1"
        y="3"
        width={w - 2}
        height="4"
        rx="1.5"
        fill="currentColor"
        opacity="0.9"
      />
      {kind === 'carrier' || kind === 'battleship' ? (
        <rect x={w * 0.35} y="1" width="3" height="2" fill="currentColor" opacity="0.7" />
      ) : null}
      {kind === 'submarine' ? (
        <circle cx={w - 3} cy="5" r="1.4" fill="currentColor" opacity="0.85" />
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
