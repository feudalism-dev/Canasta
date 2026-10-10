/** Product family locked by table LSL (creator SKU). */

export type GameFamily = 'canasta' | 'rummy' | 'trick' | 'ichi' | 'skippo'

export function normalizeFamily(raw: unknown): GameFamily {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'rummy') return 'rummy'
  if (s === 'trick') return 'trick'
  if (s === 'ichi') return 'ichi'
  if (s === 'skippo') return 'skippo'
  return 'canasta'
}

/** Prefer an explicit family hint from status or MoAP. Otherwise canasta. */
export function resolveTableFamily(...hints: unknown[]): GameFamily {
  for (const h of hints) {
    const s = String(h || '')
      .trim()
      .toLowerCase()
    if (s === 'rummy') return 'rummy'
    if (s === 'trick') return 'trick'
    if (s === 'ichi') return 'ichi'
    if (s === 'skippo') return 'skippo'
  }
  return 'canasta'
}

export function familyHintPresent(...hints: unknown[]): boolean {
  for (const h of hints) {
    const s = String(h || '')
      .trim()
      .toLowerCase()
    if (s === 'rummy' || s === 'canasta' || s === 'trick' || s === 'ichi' || s === 'skippo') {
      return true
    }
  }
  return false
}

export function familyLabel(family: GameFamily): string {
  if (family === 'rummy') return 'Rummy'
  if (family === 'trick') return 'Trick'
  if (family === 'ichi') return 'Ichi'
  if (family === 'skippo') return 'Skippo'
  return 'Canasta'
}
