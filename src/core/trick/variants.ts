import type { TrickConfig, TrickVariant, PassDirection } from './types'

export function trickConfig(variant: TrickVariant, playerCount = 4): TrickConfig {
  const n = clampTrickPlayerCount(variant, playerCount)
  if (variant === 'hearts') {
    return {
      variant: 'hearts',
      playerCount: n,
      playTo: 100,
      shootTheMoon: true,
      partnership: false,
    }
  }
  if (variant === 'rooster') {
    return {
      variant: 'rooster',
      playerCount: 4,
      playTo: 300,
      partnership: true,
      scoreAscending: false,
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
    { value: 'rooster', label: 'Rooster — partnership nest & trump (to 300)', ready: true },
    { value: 'spades', label: 'Spades — bid tricks (coming soon)', ready: false },
    { value: 'euchre', label: 'Euchre — short deck trump (coming soon)', ready: false },
  ]
}

/** Hearts: 2–4. Other variants stay 4 until implemented. */
export function clampTrickPlayerCount(variant: TrickVariant, playerCount: number): number {
  const n = Math.floor(playerCount) || 4
  if (variant === 'hearts') return Math.max(2, Math.min(4, n))
  return 4
}

export function nextPassDirection(dir: PassDirection, playerCount = 4): PassDirection {
  const n = Math.max(2, Math.min(4, playerCount))
  if (n === 2) {
    if (dir === 'hold') return 'left'
    return 'hold'
  }
  if (n === 3) {
    if (dir === 'left') return 'right'
    if (dir === 'right') return 'hold'
    return 'left'
  }
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

/** Cards each player receives for Hearts. */
export function heartsHandSize(playerCount: number): number {
  const n = Math.max(2, Math.min(4, playerCount))
  if (n === 3) return 17
  return 13
}
