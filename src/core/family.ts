/** Product family locked by table LSL (creator SKU). */

export type GameFamily = 'canasta' | 'rummy'

export function normalizeFamily(raw: unknown): GameFamily {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'rummy') return 'rummy'
  return 'canasta'
}

export function familyLabel(family: GameFamily): string {
  if (family === 'rummy') return 'Rummy'
  return 'Canasta'
}
