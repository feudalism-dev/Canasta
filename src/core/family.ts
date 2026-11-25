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
  | 'battlefleet'
  | 'warfront'

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
  'battlefleet',
  'warfront',
]

const FAMILY_ALIASES: Record<string, GameFamily> = {
  rummy: 'rummy',
  trick: 'trick',
  ichi: 'ichi',
  skippo: 'skippo',
  phaseit: 'phaseit',
  phase_it: 'phaseit',
  'phase-it': 'phaseit',
  yotsy: 'yotsy',
  yahtzee: 'yotsy',
  rowshambo: 'rowshambo',
  rsb: 'rowshambo',
  'row-sham-bo': 'rowshambo',
  row_sham_bo: 'rowshambo',
  battlefleet: 'battlefleet',
  'battle-fleet': 'battlefleet',
  battle_fleet: 'battlefleet',
  bf: 'battlefleet',
  warfront: 'warfront',
  'war-front': 'warfront',
  war_front: 'warfront',
  wf: 'warfront',
  theater: 'warfront',
  theatercommand: 'warfront',
  'theater-command': 'warfront',
}

function lookupFamily(s: string): GameFamily | null {
  return FAMILY_ALIASES[s] ?? (s === 'canasta' ? 'canasta' : null)
}

export function normalizeFamily(raw: unknown): GameFamily {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  return lookupFamily(s) ?? 'canasta'
}

/** Prefer an explicit family hint from status or MoAP. Otherwise canasta. */
export function resolveTableFamily(...hints: unknown[]): GameFamily {
  for (const h of hints) {
    const s = String(h || '')
      .trim()
      .toLowerCase()
    const f = lookupFamily(s)
    if (f) return f
  }
  return 'canasta'
}

export function familyHintPresent(...hints: unknown[]): boolean {
  for (const h of hints) {
    const s = String(h || '')
      .trim()
      .toLowerCase()
    if (lookupFamily(s) || s === 'canasta') return true
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
  if (family === 'battlefleet') return 'Battle Fleet'
  if (family === 'warfront') return 'Warfront'
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
    const f = lookupFamily(t)
    if (f) out.add(f)
    else if (t === 'canasta') out.add('canasta')
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
      case 'battlefleet':
      return `${base}assets/battlefleet_ad.png`
      case 'warfront':
      return `${base}assets/warfront_ad.svg`
      default:
      return `${base}assets/canasta_ad.jpg`
  }
}
