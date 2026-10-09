import type { Card } from '../cards'
import type { RummyConfig, RummyVariant } from './types'
import { deadwoodPoints } from './score'

export function isGinStyle(variant: RummyVariant): boolean {
  return variant === 'gin' || variant === 'oklahoma'
}

export function isTableMeldGame(variant: RummyVariant): boolean {
  return variant === 'standard' || variant === 'rummy500' || variant === 'kalooki'
}

/** Knock limit from Oklahoma's first upcard (Ace → gin only). */
export function oklahomaKnockMax(upcard: Card): number {
  if (upcard.rank === 'A') return 0
  if (upcard.rank === 'J' || upcard.rank === 'Q' || upcard.rank === 'K' || upcard.rank === '10') {
    return 10
  }
  const n = Number(upcard.rank)
  if (Number.isFinite(n)) return n
  return 10
}

export function oklahomaScoreMult(upcard: Card): number {
  return upcard.suit === 'S' ? 2 : 1
}

export function rummyConfig(variant: RummyVariant, playerCount: number): RummyConfig {
  if (variant === 'gin') {
    return {
      variant,
      playerCount: 2,
      handSize: 10,
      deckCount: 1,
      jokers: false,
      faceDeadwood: 10,
      aceDeadwood: 1,
      playTo: 100,
      knockMax: 10,
      ginBonus: 25,
      undercutBonus: 25,
      scoreAscending: false,
    }
  }
  if (variant === 'oklahoma') {
    return {
      variant,
      playerCount: 2,
      handSize: 10,
      deckCount: 1,
      jokers: false,
      faceDeadwood: 10,
      aceDeadwood: 1,
      playTo: 150,
      knockMax: 10,
      ginBonus: 25,
      undercutBonus: 25,
      scoreAscending: false,
      oklahoma: true,
    }
  }
  if (variant === 'rummy500') {
    const n = Math.max(2, Math.min(4, playerCount))
    return {
      variant,
      playerCount: n,
      handSize: n <= 2 ? 13 : 7,
      deckCount: n >= 5 ? 2 : 1,
      jokers: false,
      faceDeadwood: 10,
      aceDeadwood: 15,
      playTo: 500,
      scoreAscending: false,
      deepDiscard: true,
      meldScoring: true,
    }
  }
  if (variant === 'kalooki') {
    const n = Math.max(2, Math.min(4, playerCount))
    return {
      variant,
      playerCount: n,
      handSize: 13,
      deckCount: 2,
      jokers: true,
      faceDeadwood: 10,
      aceDeadwood: 1,
      blackAceDeadwood: 15,
      playTo: null,
      handsPerMatch: 9,
      scoreAscending: true,
      allowJokersInMelds: true,
    }
  }
  const n = Math.max(2, Math.min(4, playerCount))
  return {
    variant: 'standard',
    playerCount: n,
    handSize: 7,
    deckCount: n >= 4 ? 2 : 1,
    jokers: false,
    faceDeadwood: 10,
    aceDeadwood: 1,
    playTo: 100,
    scoreAscending: true,
  }
}

export function rummyVariantOptions(): { value: RummyVariant; label: string; ready: boolean }[] {
  return [
    { value: 'standard', label: 'Standard Rummy — to 100 (lowest wins)', ready: true },
    { value: 'gin', label: 'Gin Rummy — 2 players, to 100 (highest wins)', ready: true },
    { value: 'oklahoma', label: 'Oklahoma Gin — knock from upcard, to 150', ready: true },
    { value: 'rummy500', label: 'Rummy 500 — meld scoring, to 500 (highest wins)', ready: true },
    { value: 'kalooki', label: 'Kalooki (open) — jokers, 9 hands (lowest wins)', ready: true },
  ]
}

export function clampRummyPlayerCount(variant: RummyVariant, playerCount: number): number {
  if (isGinStyle(variant)) return 2
  return Math.max(2, Math.min(4, Math.floor(playerCount) || 2))
}

export function cardScorePoints(card: Card, config: RummyConfig): number {
  return deadwoodPoints(card, config)
}
