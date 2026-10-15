import type { RowShamBoConfig, RowShamBoVariant } from './types'

export const MATCH_TARGETS = [100, 200, 300, 400, 500] as const

export function clampRowShamBoPlayerCount(playerCount: number): number {
  const n = Math.floor(playerCount) || 2
  return Math.max(2, Math.min(4, n))
}

export function normalizeRowShamBoVariant(raw: unknown): RowShamBoVariant {
  if (raw === 'triples' || raw === 'elements') return raw
  return 'classic'
}

export function clampMatchTarget(playTo: number): number {
  const n = Math.floor(playTo) || 100
  if ((MATCH_TARGETS as readonly number[]).includes(n)) return n
  if (n < 100) return 100
  if (n > 500) return 500
  return 100
}

export function rowShamBoConfig(
  variant: RowShamBoVariant = 'classic',
  playerCount = 2,
  playTo = 100,
): RowShamBoConfig {
  return {
    variant,
    playerCount: clampRowShamBoPlayerCount(playerCount),
    playTo: clampMatchTarget(playTo),
  }
}

export function rowShamBoVariantOptions(): {
  value: RowShamBoVariant
  label: string
  ready: boolean
}[] {
  return [
    {
      value: 'classic',
      label: 'Classic — Rock / Paper / Scissors / Dynamite',
      ready: true,
    },
    {
      value: 'triples',
      label: 'Triples — three face-down slots (coming soon)',
      ready: false,
    },
    {
      value: 'elements',
      label: 'Elements — Water / Earth / Fire (coming soon)',
      ready: false,
    },
  ]
}

export function rowShamBoVariantLabel(v: RowShamBoVariant): string {
  if (v === 'triples') return 'Triples Row! Sham! Bo!'
  if (v === 'elements') return 'Elements Row! Sham! Bo!'
  return 'Classic Row! Sham! Bo!'
}

export function rowShamBoTip(v: RowShamBoVariant): string {
  if (v === 'triples') {
    return 'Play three cards into slots each hand; resolve slot-by-slot. Coming soon.'
  }
  if (v === 'elements') {
    return '64-card deck with Water, Earth, and Fire. Coming soon.'
  }
  return 'Pass once on turn 1. Fight direction re-rolls every round. Draw → play → duel until the deck is gone. First to the match score wins.'
}

export function directionLabel(d: 'cw' | 'ccw'): string {
  return d === 'cw' ? 'Clockwise' : 'Counter-clockwise'
}
