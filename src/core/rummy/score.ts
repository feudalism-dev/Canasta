import type { Card } from '../cards'
import type { RummyConfig } from './types'

export function deadwoodPoints(card: Card, config: RummyConfig): number {
  if (card.rank === 'JOKER') return 50
  if (card.rank === 'A') return config.aceDeadwood
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return config.faceDeadwood
  if (card.rank === '10') return 10
  const n = Number(card.rank)
  if (Number.isFinite(n)) return n
  return config.faceDeadwood
}

export function handDeadwood(hand: Card[], config: RummyConfig): number {
  return hand.reduce((sum, c) => sum + deadwoodPoints(c, config), 0)
}
