/**
 * Symmetric Crossroads map — 28 zones, 4-way radial.
 * Layout coords are normalized 0–1 for HUD / minimap.
 */

export type MapBlueprint = {
  zoneCount: number
  adj: number[][]
  layout: { x: number; y: number }[]
  /** Zone ids that have a facility (depot/port). */
  facilities: number[]
  /** Per seat 0–3: [homeFacility, satelliteA, satelliteB]. */
  homes: number[][]
}

function key(c: number, r: number): string {
  return `${c},${r}`
}

/**
 * Build a diamond/cross grid in axial-ish integer coords, then project to 0–1.
 * Ring structure ensures 4-way symmetry for up to 4 players.
 */
export function buildCrossroadsMap(): MapBlueprint {
  // Explicit symmetric node list (c, r) — 28 cells
  const nodes: { c: number; r: number; facility?: boolean; homeSeat?: number }[] = [
    // Seat 0 home cluster (north) — home at (0,-3)
    { c: 0, r: -3, facility: true, homeSeat: 0 },
    { c: -1, r: -2 },
    { c: 1, r: -2 },
    // Seat 1 (east)
    { c: 3, r: 0, facility: true, homeSeat: 1 },
    { c: 2, r: -1 },
    { c: 2, r: 1 },
    // Seat 2 (south)
    { c: 0, r: 3, facility: true, homeSeat: 2 },
    { c: -1, r: 2 },
    { c: 1, r: 2 },
    // Seat 3 (west)
    { c: -3, r: 0, facility: true, homeSeat: 3 },
    { c: -2, r: -1 },
    { c: -2, r: 1 },
    // Inner ring facilities (contestable)
    { c: 0, r: -1, facility: true },
    { c: 1, r: 0, facility: true },
    { c: 0, r: 1, facility: true },
    { c: -1, r: 0, facility: true },
    // Mid belt
    { c: -1, r: -1 },
    { c: 1, r: -1 },
    { c: 1, r: 1 },
    { c: -1, r: 1 },
    // Outer diagonals
    { c: -2, r: -2 },
    { c: 2, r: -2 },
    { c: 2, r: 2 },
    { c: -2, r: 2 },
    // Cardinal mid approaches
    { c: 0, r: -2 },
    { c: 2, r: 0 },
    { c: 0, r: 2 },
    { c: -2, r: 0 },
  ]

  const indexByKey = new Map<string, number>()
  nodes.forEach((n, i) => indexByKey.set(key(n.c, n.r), i))

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]

  const adj: number[][] = nodes.map(() => [])
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!
    const near: number[] = []
    for (const [dc, dr] of dirs) {
      const j = indexByKey.get(key(n.c + dc, n.r + dr))
      if (j == null) continue
      // Prefer orthogonal; allow diagonal only if Manhattan distance to neighbor is 2 and no ortho bridge
      const manhattan = Math.abs(dc) + Math.abs(dr)
      if (manhattan === 1) near.push(j)
      else if (manhattan === 2 && Math.abs(dc) === 1 && Math.abs(dr) === 1) {
        // Diagonal only when both ortho cells missing would isolate — keep limited diagonals for connectivity
        const orthoA = indexByKey.get(key(n.c + dc, n.r))
        const orthoB = indexByKey.get(key(n.c, n.r + dr))
        if (orthoA == null || orthoB == null) near.push(j)
      }
    }
    // Always connect to ortho if present; also force ring connectivity for mid approaches
    adj[i] = [...new Set(near)].sort((a, b) => a - b)
  }

  // Ensure each home connects to its satellites and toward center
  const ensure = (a: number, b: number) => {
    if (!adj[a]!.includes(b)) adj[a]!.push(b)
    if (!adj[b]!.includes(a)) adj[b]!.push(a)
  }

  // Homes: seat clusters are indices 0-2, 3-5, 6-8, 9-11
  for (const base of [0, 3, 6, 9]) {
    ensure(base, base + 1)
    ensure(base, base + 2)
    ensure(base + 1, base + 2)
  }
  // Link homes toward inner facilities
  ensure(0, 24) // N home → N approach
  ensure(24, 12) // → N inner depot
  ensure(3, 25)
  ensure(25, 13)
  ensure(6, 26)
  ensure(26, 14)
  ensure(9, 27)
  ensure(27, 15)
  // Inner cross
  ensure(12, 13)
  ensure(13, 14)
  ensure(14, 15)
  ensure(15, 12)
  ensure(12, 16)
  ensure(12, 17)
  ensure(13, 17)
  ensure(13, 18)
  ensure(14, 18)
  ensure(14, 19)
  ensure(15, 19)
  ensure(15, 16)

  for (let i = 0; i < adj.length; i++) {
    adj[i] = [...new Set(adj[i])].sort((a, b) => a - b)
  }

  let minC = Infinity
  let maxC = -Infinity
  let minR = Infinity
  let maxR = -Infinity
  for (const n of nodes) {
    minC = Math.min(minC, n.c)
    maxC = Math.max(maxC, n.c)
    minR = Math.min(minR, n.r)
    maxR = Math.max(maxR, n.r)
  }
  const layout = nodes.map((n) => ({
    x: (n.c - minC) / (maxC - minC || 1),
    y: (n.r - minR) / (maxR - minR || 1),
  }))

  const facilities = nodes
    .map((n, i) => (n.facility ? i : -1))
    .filter((i) => i >= 0)

  const homes: number[][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9, 10, 11],
  ]

  return {
    zoneCount: nodes.length,
    adj,
    layout,
    facilities,
    homes,
  }
}

export function neighborsOf(adj: number[][], zoneId: number): number[] {
  return adj[zoneId] ?? []
}

export function areAdjacent(adj: number[][], a: number, b: number): boolean {
  return (adj[a] ?? []).includes(b)
}
