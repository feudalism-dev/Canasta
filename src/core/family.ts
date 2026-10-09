/** Product family locked by table LSL (creator SKU). */

export type GameFamily = 'canasta' | 'rummy'

export function normalizeFamily(raw: unknown): GameFamily {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'rummy') return 'rummy'
  return 'canasta'
}

/** Prefer rummy if any hint says so (status or MoAP). Otherwise canasta. */
export function resolveTableFamily(...hints: unknown[]): GameFamily {
  for (const h of hints) {
    const s = String(h || '')
      .trim()
      .toLowerCase()
    if (s === 'rummy') return 'rummy'
  }
  return 'canasta'
}

export function familyHintPresent(...hints: unknown[]): boolean {
  for (const h of hints) {
    const s = String(h || '')
      .trim()
      .toLowerCase()
    if (s === 'rummy' || s === 'canasta') return true
  }
  return false
}

export function familyLabel(family: GameFamily): string {
  if (family === 'rummy') return 'Rummy'
  return 'Canasta'
}
