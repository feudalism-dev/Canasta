import { phasesToWin } from './phases'
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
      label: 'Classic — phases 1→10 in order',
      ready: true,
    },
    {
      value: 'masters',
      label: 'Masters — pick any remaining phase each hand',
      ready: true,
    },
    {
      value: 'sprint',
      label: 'Sprint — race through phases 1→5',
      ready: true,
    },
  ]
}

export function phaseItVariantLabel(v: PhaseItVariant): string {
  if (v === 'masters') return 'Masters Phase It'
  if (v === 'sprint') return 'Sprint Phase It'
  return 'Classic Phase It'
}

export function phaseItTip(v: PhaseItVariant): string {
  if (v === 'masters') {
    return `Each hand, choose which of your remaining phases to attempt. First to finish all ${phasesToWin('masters')} phases wins.`
  }
  if (v === 'sprint') {
    return 'Shorter race: only phases 1–5. Draw, lay your phase, hit, discard. First through phase 5 wins.'
  }
  return 'Draw, complete your phase (sets / runs / color), then hit and discard. First through all 10 phases wins.'
}

export function isMastersVariant(v: PhaseItVariant): boolean {
  return v === 'masters'
}
