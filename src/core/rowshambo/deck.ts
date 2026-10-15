import { mulberry32, shuffleInPlace } from '../rng'
import type { RowShamBoCard, RowShamBoKind, RowShamBoVariant } from './types'
import { kindLabel } from './compare'

const CLASSIC_COUNTS: { kind: RowShamBoKind; n: number }[] = [
  { kind: 'rock', n: 16 },
  { kind: 'paper', n: 16 },
  { kind: 'scissors', n: 16 },
  { kind: 'dynamite', n: 4 },
]

const ELEMENT_COUNTS: { kind: RowShamBoKind; n: number }[] = [
  ...CLASSIC_COUNTS,
  { kind: 'water', n: 4 },
  { kind: 'earth', n: 4 },
  { kind: 'fire', n: 4 },
]

export function buildRowShamBoDeck(variant: RowShamBoVariant = 'classic'): RowShamBoCard[] {
  const counts = variant === 'elements' ? ELEMENT_COUNTS : CLASSIC_COUNTS
  const cards: RowShamBoCard[] = []
  let i = 0
  for (const { kind, n } of counts) {
    for (let c = 0; c < n; c++) {
      cards.push({ id: `w${i++}`, kind })
    }
  }
  return cards
}

export function shuffleDeck(deck: RowShamBoCard[], seed: number): RowShamBoCard[] {
  return shuffleInPlace([...deck], mulberry32(seed))
}

export function cardLabel(card: RowShamBoCard): string {
  return kindLabel(card.kind)
}

export function sortHand(hand: RowShamBoCard[]): RowShamBoCard[] {
  const order: RowShamBoKind[] = [
    'rock',
    'paper',
    'scissors',
    'water',
    'earth',
    'fire',
    'dynamite',
  ]
  return [...hand].sort((a, b) => {
    const da = order.indexOf(a.kind)
    const db = order.indexOf(b.kind)
    if (da !== db) return da - db
    return a.id.localeCompare(b.id)
  })
}
