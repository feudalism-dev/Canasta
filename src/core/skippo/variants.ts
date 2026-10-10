import type { SkippoConfig, SkippoVariant } from './types'

export function clampSkippoPlayerCount(playerCount: number): number {
  const n = Math.floor(playerCount) || 4
  return Math.max(2, Math.min(4, n))
}

export function skippoConfig(variant: SkippoVariant = 'classic', playerCount = 4): SkippoConfig {
  const n = clampSkippoPlayerCount(playerCount)
  return { variant, playerCount: n, playTo: 500, stockSize: 30 }
}

export function skippoVariantOptions(): { value: SkippoVariant; label: string; ready: boolean }[] {
  return [
    {
      value: 'classic',
      label: 'Classic Skippo — build 1–12, empty your stock (to 500)',
      ready: true,
    },
  ]
}

export function skippoVariantLabel(v: SkippoVariant): string {
  void v
  return 'Classic Skippo'
}

export function skippoTip(v: SkippoVariant): string {
  void v
  return 'Refill to 5, play onto builders (1→12), then discard one. Empty your stock to win the hand. Skippo cards are wild.'
}
