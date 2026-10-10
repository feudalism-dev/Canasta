import type { IchiConfig, IchiVariant } from './types'

export function clampIchiPlayerCount(playerCount: number): number {
  const n = Math.floor(playerCount) || 4
  return Math.max(2, Math.min(4, n))
}

export function ichiConfig(variant: IchiVariant = 'classic', playerCount = 4): IchiConfig {
  const n = clampIchiPlayerCount(playerCount)
  if (variant === 'palace') {
    return { variant, playerCount: n, playTo: 3 }
  }
  if (variant === 'classic' || variant === 'flip') {
    return { variant, playerCount: n, playTo: 500 }
  }
  return { variant, playerCount: n, playTo: 200 }
}

export function ichiDealCount(variant: IchiVariant): number {
  if (variant === 'palace') return 3 // hand only; up/down separate
  if (variant === 'dos') return 7
  if (variant === 'eights') return 7
  return 7
}

export function ichiVariantOptions(): { value: IchiVariant; label: string; ready: boolean }[] {
  return [
    { value: 'classic', label: 'Classic Ichi — Skip / Reverse / +2 / Wild (to 500)', ready: true },
    { value: 'eights', label: 'Crazy Eights — 8s & Wilds name color (to 200)', ready: true },
    { value: 'dos', label: 'Twin Piles — two discards, double numbers (to 200)', ready: true },
    { value: 'switch', label: 'Switch — action ranks, stacking 2s (to 200)', ready: true },
    { value: 'palace', label: 'Palace — hand + up + down piles (first to 3 wins)', ready: true },
    { value: 'flip', label: 'Ichi Flip — light/dark sides (to 500)', ready: true },
  ]
}

export function ichiVariantLabel(v: IchiVariant): string {
  if (v === 'eights') return 'Crazy Eights'
  if (v === 'dos') return 'Twin Piles'
  if (v === 'switch') return 'Switch'
  if (v === 'palace') return 'Palace'
  if (v === 'flip') return 'Ichi Flip'
  return 'Classic Ichi'
}

export function ichiTip(v: IchiVariant): string {
  if (v === 'eights') {
    return 'Match color or number. 8s and Wilds let you name the next color. First empty hand scores opponents’ cards.'
  }
  if (v === 'dos') {
    return 'Two discard piles — play a matching card on either. Same number twice can hit both piles or one pile as a double.'
  }
  if (v === 'switch') {
    return 'Match color or symbol. 2s force draws (stackable). Skip / Reverse / Wild work as labeled. Clear your hand.'
  }
  if (v === 'palace') {
    return 'Play equal or higher on the pile. Clear your hand, then ups, then downs. Stuck? Take the pile. First to win 3 hands.'
  }
  if (v === 'flip') {
    return 'Light and dark faces. Play Flip to turn the whole table. Match the active side’s color or symbol.'
  }
  return 'Match color or symbol. Skip / Reverse / +2 hit the next player. Wild picks color; +4 can be challenged. Call Ichi at one card.'
}
