import type { YotsyConfig, YotsyVariant } from './types'

export function clampYotsyPlayerCount(playerCount: number): number {
  const n = Math.floor(playerCount) || 2
  return Math.max(1, Math.min(4, n))
}

export function yotsyConfig(variant: YotsyVariant = 'classic', playerCount = 2): YotsyConfig {
  const n = clampYotsyPlayerCount(playerCount)
  return { variant, playerCount: n, playTo: null }
}

export function yotsyVariantOptions(): { value: YotsyVariant; label: string; ready: boolean }[] {
  return [
    {
      value: 'classic',
      label: 'Classic Yotsy — five dice, 13 boxes',
      ready: true,
    },
    {
      value: 'yacht',
      label: 'Yacht — 1938 ancestor, 12 boxes, no bonus',
      ready: true,
    },
    {
      value: 'generala',
      label: 'Generala — escalera, póker, servida win',
      ready: true,
    },
    {
      value: 'kismet',
      label: 'Kismet — colored pips, flush & bonus tiers',
      ready: true,
    },
  ]
}

export function yotsyVariantLabel(v: YotsyVariant): string {
  if (v === 'kismet') return 'Kismet'
  if (v === 'yacht') return 'Yacht'
  if (v === 'generala') return 'Generala'
  return 'Classic Yotsy'
}

export function yotsyTip(v: YotsyVariant): string {
  if (v === 'kismet') {
    return 'Colored dice (1/6 black, 2/5 red, 3/4 green). Flush, same-color pairs, and tiered upper bonuses.'
  }
  if (v === 'yacht') {
    return 'Twelve boxes. Full House scores the dice total; straights must be exact 1–5 or 2–6. No upper bonus.'
  }
  if (v === 'generala') {
    return 'First-roll Escalera/Full/Póker +5. Generala servida (five alike on first roll) wins the match instantly.'
  }
  return 'Roll up to three times, hold keepers, then score a box. Highest total after 13 turns wins.'
}

export function yotsyBoxesLabel(v: YotsyVariant): string {
  if (v === 'kismet') return '15 boxes (Kismet)'
  if (v === 'yacht') return '12 boxes (Yacht)'
  if (v === 'generala') return '11 boxes (Generala)'
  return '13 boxes'
}

/** Normalize legacy stub id `dismet` → kismet. */
export function normalizeYotsyVariant(raw: unknown): YotsyVariant {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'kismet' || s === 'dismet') return 'kismet'
  if (s === 'yacht') return 'yacht'
  if (s === 'generala' || s === 'general') return 'generala'
  return 'classic'
}
