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
      value: 'dismet',
      label: 'Dismet — colored numbers (coming soon)',
      ready: false,
    },
  ]
}

export function yotsyVariantLabel(v: YotsyVariant): string {
  if (v === 'dismet') return 'Dismet'
  return 'Classic Yotsy'
}

export function yotsyTip(v: YotsyVariant): string {
  if (v === 'dismet') return 'Colored-number Dismet — coming soon.'
  return 'Roll up to three times, hold keepers, then score a box. Highest total after 13 turns wins.'
}
