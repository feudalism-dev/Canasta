import { BOARD_SIZE, QUAD_SIZE, type Cell } from './types'

/** Column letter A–T for global x. */
export function colLabel(x: number): string {
  return String.fromCharCode(65 + x)
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function parseCellKey(key: string): Cell {
  const [a, b] = key.split(',')
  return { x: Number(a), y: Number(b) }
}

export function inBoard(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE
}

/**
 * Free-for-all quadrant by player index 0..3:
 * 0 UL, 1 UR, 2 LL, 3 LR
 */
export function ffaQuadrantOrigin(playerIndex: number): Cell {
  const i = ((playerIndex % 4) + 4) % 4
  if (i === 0) return { x: 0, y: 0 }
  if (i === 1) return { x: QUAD_SIZE, y: 0 }
  if (i === 2) return { x: 0, y: QUAD_SIZE }
  return { x: QUAD_SIZE, y: QUAD_SIZE }
}

/** Two-player: diagonally opposite (P0 UL, P1 LR). */
export function twoPlayerOrigins(): [Cell, Cell] {
  return [
    { x: 0, y: 0 },
    { x: QUAD_SIZE, y: QUAD_SIZE },
  ]
}

/** Team A: rows 0–9 (upper). Team B: rows 10–19 (lower). Full width. */
export function teamTerritory(teamId: 'A' | 'B'): {
  x0: number
  y0: number
  width: number
  height: number
} {
  if (teamId === 'A') return { x0: 0, y0: 0, width: BOARD_SIZE, height: QUAD_SIZE }
  return { x0: 0, y0: QUAD_SIZE, width: BOARD_SIZE, height: QUAD_SIZE }
}

export function cellInRect(
  x: number,
  y: number,
  rect: { x0: number; y0: number; width: number; height: number },
): boolean {
  return (
    x >= rect.x0 &&
    y >= rect.y0 &&
    x < rect.x0 + rect.width &&
    y < rect.y0 + rect.height
  )
}

export function ffaTerritory(
  playerIndex: number,
  playerCount: number,
): { x0: number; y0: number; width: number; height: number } | null {
  if (playerCount === 2) {
    const origins = twoPlayerOrigins()
    const o = origins[playerIndex as 0 | 1]
    if (!o) return null
    return { x0: o.x, y0: o.y, width: QUAD_SIZE, height: QUAD_SIZE }
  }
  if (playerIndex < 0 || playerIndex >= playerCount || playerIndex > 3) return null
  const o = ffaQuadrantOrigin(playerIndex)
  return { x0: o.x, y0: o.y, width: QUAD_SIZE, height: QUAD_SIZE }
}

/** Which FFA player index owns a global cell, or -1 if inactive. */
export function ownerIndexAt(
  x: number,
  y: number,
  playerCount: number,
): number {
  for (let i = 0; i < playerCount; i++) {
    const t = ffaTerritory(i, playerCount)
    if (t && cellInRect(x, y, t)) return i
  }
  return -1
}

export function teamIdAt(x: number, y: number): 'A' | 'B' | null {
  if (!inBoard(x, y)) return null
  if (y < QUAD_SIZE) return 'A'
  return 'B'
}
