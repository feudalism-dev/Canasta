import type { PhaseItConfig, PhaseItVariant } from './types'

export function clampPhaseItPlayerCount(playerCount: number): number {
  const n = Math.floor(playerCount) || 4
  return Math.max(2, Math.min(4, n))
}

export function phaseItConfig(variant: PhaseItVariant = 'classic', playerCount = 4): PhaseItConfig {
  const n = clampPhaseItPlayerCount(playerCount)
  return { variant, playerCount: n, playTo: null }
}

export function phaseItVariantOptions(): { value: PhaseItVariant; label: string; ready: boolean }[] {
  return [
    {
      value: 'classic',
      label: 'Classic Phase It — race through 10 phases',
      ready: true,
    },
  ]
}

export function phaseItVariantLabel(v: PhaseItVariant): string {
  void v
  return 'Classic Phase It'
}

export function phaseItTip(v: PhaseItVariant): string {
  void v
  return 'Draw, complete your phase (sets / runs / color), then hit and discard. First through all 10 phases wins.'
}
