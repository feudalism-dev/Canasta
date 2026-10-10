/** Product family locked by table LSL (creator SKU). */

export type GameFamily = 'canasta' | 'rummy' | 'trick' | 'ichi' | 'skippo' | 'phaseit'

export function normalizeFamily(raw: unknown): GameFamily {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'rummy') return 'rummy'
  if (s === 'trick') return 'trick'
  if (s === 'ichi') return 'ichi'
  if (s === 'skippo') return 'skippo'
  if (s === 'phaseit' || s === 'phase_it' || s === 'phase-it') return 'phaseit'
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
    if (s === 'phaseit' || s === 'phase_it' || s === 'phase-it') return 'phaseit'
  }
  return 'canasta'
}

export function familyHintPresent(...hints: unknown[]): boolean {
  for (const h of hints) {
    const s = String(h || '')
      .trim()
      .toLowerCase()
    if (
      s === 'rummy' ||
      s === 'canasta' ||
      s === 'trick' ||
      s === 'ichi' ||
      s === 'skippo' ||
      s === 'phaseit' ||
      s === 'phase_it' ||
      s === 'phase-it'
    ) {
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
  if (family === 'phaseit') return 'Phase It'
  return 'Canasta'
}
