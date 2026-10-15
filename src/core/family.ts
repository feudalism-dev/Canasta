/** Product family locked by table LSL (creator SKU) or hub picker. */

export type GameFamily =
  | 'canasta'
  | 'rummy'
  | 'trick'
  | 'ichi'
  | 'skippo'
  | 'phaseit'
  | 'yotsy'
  | 'rowshambo'

/** All hub-selectable families (picker order). */
export const GAME_FAMILIES: GameFamily[] = [
  'canasta',
  'rummy',
  'trick',
  'ichi',
  'skippo',
  'phaseit',
  'yotsy',
  'rowshambo',
]

export function normalizeFamily(raw: unknown): GameFamily {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'rummy') return 'rummy'
  if (s === 'trick') return 'trick'
  if (s === 'ichi') return 'ichi'
  if (s === 'skippo') return 'skippo'
  if (s === 'phaseit' || s === 'phase_it' || s === 'phase-it') return 'phaseit'
  if (s === 'yotsy' || s === 'yahtzee') return 'yotsy'
  if (s === 'rowshambo' || s === 'rsb' || s === 'row-sham-bo' || s === 'row_sham_bo') {
    return 'rowshambo'
  }
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
    if (s === 'yotsy' || s === 'yahtzee') return 'yotsy'
    if (s === 'rowshambo' || s === 'rsb' || s === 'row-sham-bo' || s === 'row_sham_bo') {
      return 'rowshambo'
    }
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
      s === 'phase-it' ||
      s === 'yotsy' ||
      s === 'yahtzee' ||
      s === 'rowshambo' ||
      s === 'rsb' ||
      s === 'row-sham-bo' ||
      s === 'row_sham_bo'
    ) {
      return true
    }
  }
  return false
}

export function familyLabel(family: GameFamily): string {
  if (family === 'rummy') return 'Rummy'
  if (family === 'trick') return 'Rooster'
  if (family === 'ichi') return 'Ichi'
  if (family === 'skippo') return 'Skippo'
  if (family === 'phaseit') return 'Phase It'
  if (family === 'yotsy') return 'Yotsy'
  if (family === 'rowshambo') return 'Row! Sham! Bo!'
  return 'Canasta'
}

/** Parse table status `entitlements` CSV (`canasta,rummy,…`). */
export function parseEntitlements(raw: unknown): Set<GameFamily> {
  const out = new Set<GameFamily>()
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (!s) return out
  for (const part of s.split(/[,\s]+/)) {
    const t = part.trim()
    if (!t) continue
    if (
      t === 'canasta' ||
      t === 'rummy' ||
      t === 'trick' ||
      t === 'ichi' ||
      t === 'skippo' ||
      t === 'phaseit' ||
      t === 'yotsy' ||
      t === 'rowshambo'
    ) {
      out.add(t)
    }
  }
  return out
}

/** Ad art in `public/assets/` for the hub game picker. */
export function familyAdSrc(family: GameFamily): string {
  const base = import.meta.env.BASE_URL
  switch (family) {
    case 'rummy':
      return `${base}assets/rummy_ad.jpg`
    case 'trick':
      return `${base}assets/rooster_ad.jpg`
    case 'ichi':
      return `${base}assets/ichi_ad.jpg`
    case 'skippo':
      return `${base}assets/skippo_ad.jpg`
    case 'phaseit':
      return `${base}assets/phaseIt_ad.jpg`
    case 'yotsy':
      return `${base}assets/yotsy_ad.jpg`
    case 'rowshambo':
      return `${base}assets/rowshambo_ad.jpg`
    default:
      return `${base}assets/canasta_ad.jpg`
  }
}
