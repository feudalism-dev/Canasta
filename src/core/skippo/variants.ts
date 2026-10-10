import type { SkippoConfig, SkippoVariant } from './types'

export function clampSkippoPlayerCount(playerCount: number, variant: SkippoVariant = 'classic'): number {
  if (variant === 'partners') return 4
  const n = Math.floor(playerCount) || 4
  return Math.max(2, Math.min(4, n))
}

export function skippoConfig(variant: SkippoVariant = 'classic', playerCount = 4): SkippoConfig {
  const n = clampSkippoPlayerCount(playerCount, variant)
  if (variant === 'short') {
    return { variant, playerCount: n, playTo: 300, stockSize: 20, partners: false, jumpIn: false }
  }
  if (variant === 'partners') {
    return { variant, playerCount: 4, playTo: 500, stockSize: 30, partners: true, jumpIn: false }
  }
  if (variant === 'jumpin') {
    return { variant, playerCount: n, playTo: 500, stockSize: 30, partners: false, jumpIn: true }
  }
  return { variant, playerCount: n, playTo: 500, stockSize: 30, partners: false, jumpIn: false }
}

export function skippoVariantOptions(): { value: SkippoVariant; label: string; ready: boolean }[] {
  return [
    {
      value: 'classic',
      label: 'Classic Skippo — stock 30, build 1–12 (to 500)',
      ready: true,
    },
    {
      value: 'short',
      label: 'Short Stock — stock 20, quicker hands (to 300)',
      ready: true,
    },
    {
      value: 'partners',
      label: 'Partners — 4 seats, across teams (to 500)',
      ready: true,
    },
    {
      value: 'jumpin',
      label: 'Jump-In — exact rank off-turn (to 500)',
      ready: true,
    },
  ]
}

export function skippoVariantLabel(v: SkippoVariant): string {
  if (v === 'short') return 'Short Stock'
  if (v === 'partners') return 'Partners'
  if (v === 'jumpin') return 'Jump-In'
  return 'Classic Skippo'
}

export function skippoTip(v: SkippoVariant): string {
  if (v === 'short') {
    return 'Same rules as Classic with a 20-card stock. First to empty stock; match to 300.'
  }
  if (v === 'partners') {
    return 'Four players — partners sit across. Either partner emptying the stock scores for the team.'
  }
  if (v === 'jumpin') {
    return 'Classic play, plus: off-turn you may jump in with an exact rank (no wilds) onto a builder.'
  }
  return 'Refill to 5, play onto builders (1→12), then discard one. Empty your stock to win the hand. Skippo cards are wild.'
}

/** Partner player index by physical seat (across the table). */
export function partnerIndex(state: { players: { seat: number }[] }, playerIndex: number): number | null {
  const me = state.players[playerIndex]
  if (!me) return null
  const want = (me.seat + 2) % 4
  const idx = state.players.findIndex((p) => p.seat === want)
  return idx >= 0 && idx !== playerIndex ? idx : null
}
