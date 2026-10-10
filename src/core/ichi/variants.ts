import type { IchiConfig, IchiVariant } from './types'

export function clampIchiPlayerCount(playerCount: number): number {
  const n = Math.floor(playerCount) || 4
  return Math.max(2, Math.min(4, n))
}

export function ichiConfig(variant: IchiVariant = 'classic', playerCount = 4): IchiConfig {
  return {
    variant,
    playerCount: clampIchiPlayerCount(playerCount),
    playTo: 500,
  }
}

export function ichiVariantOptions(): { value: IchiVariant; label: string; ready: boolean }[] {
  return [{ value: 'classic', label: 'Classic Ichi — shed to empty, to 500', ready: true }]
}

export function ichiVariantLabel(v: IchiVariant): string {
  if (v === 'classic') return 'Classic Ichi'
  return 'Ichi'
}
