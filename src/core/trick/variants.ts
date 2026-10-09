import type { TrickConfig, TrickVariant, PassDirection } from './types'

export function trickConfig(variant: TrickVariant, playerCount = 4): TrickConfig {
  void playerCount
  if (variant === 'hearts') {
    return {
      variant: 'hearts',
      playerCount: 4,
      playTo: 100,
      shootTheMoon: true,
      partnership: false,
    }
  }
  if (variant === 'rooster') {
    return {
      variant: 'rooster',
      playerCount: 4,
      playTo: 500,
      partnership: true,
    }
  }
  if (variant === 'spades') {
    return {
      variant: 'spades',
      playerCount: 4,
      playTo: 500,
      partnership: true,
    }
  }
  return {
    variant: 'euchre',
    playerCount: 4,
    playTo: 10,
    partnership: true,
  }
}

export function trickVariantOptions(): { value: TrickVariant; label: string; ready: boolean }[] {
  return [
    { value: 'hearts', label: 'Hearts — avoid points, to 100 (lowest wins)', ready: true },
    { value: 'rooster', label: 'Rooster — Rook-style nest & trump (coming soon)', ready: false },
    { value: 'spades', label: 'Spades — bid tricks (coming soon)', ready: false },
    { value: 'euchre', label: 'Euchre — short deck trump (coming soon)', ready: false },
  ]
}

export function clampTrickPlayerCount(variant: TrickVariant, playerCount: number): number {
  void playerCount
  // Hearts / Rooster / Spades / Euchre v1: always 4.
  if (variant === 'hearts' || variant === 'rooster' || variant === 'spades' || variant === 'euchre') {
    return 4
  }
  return 4
}

export function nextPassDirection(dir: PassDirection): PassDirection {
  if (dir === 'left') return 'right'
  if (dir === 'right') return 'across'
  if (dir === 'across') return 'hold'
  return 'left'
}

export function passDirectionLabel(dir: PassDirection): string {
  if (dir === 'left') return 'left'
  if (dir === 'right') return 'right'
  if (dir === 'across') return 'across'
  return 'hold (no pass)'
}
