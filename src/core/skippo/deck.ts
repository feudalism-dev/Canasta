import { mulberry32, shuffleInPlace } from '../rng'
import type { SkippoCard, SkippoRank } from './types'

const RANKS: SkippoRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function buildSkippoDeck(): SkippoCard[] {
  const cards: SkippoCard[] = []
  for (const rank of RANKS) {
    for (let i = 0; i < 12; i++) {
      cards.push({ id: `r${rank}-${i}`, rank })
    }
  }
  for (let i = 0; i < 18; i++) {
    cards.push({ id: `w${i}`, rank: null })
  }
  return cards
}

export function shuffleDeck(deck: SkippoCard[], seed: number): SkippoCard[] {
  return shuffleInPlace([...deck], mulberry32(seed))
}

export function isWild(card: SkippoCard): boolean {
  return card.rank == null
}

export function cardLabel(card: SkippoCard): string {
  return card.rank == null ? 'S' : String(card.rank)
}

export function cardPoints(card: SkippoCard): number {
  return card.rank == null ? 25 : 5
}

export function sortSkippoHand(hand: SkippoCard[]): SkippoCard[] {
  return [...hand].sort((a, b) => {
    const ra = a.rank ?? 13
    const rb = b.rank ?? 13
    if (ra !== rb) return ra - rb
    return a.id.localeCompare(b.id)
  })
}

/** Compact face for BOARD wire: `1`–`12` or `S`. */
export function encodeSkippoFace(card: SkippoCard): string {
  return card.rank == null ? 'S' : String(card.rank)
}

export function parseSkippoFace(raw: string): SkippoCard | null {
  const s = raw.trim()
  if (!s || s === '-') return null
  if (s === 'S' || s === 's') return { id: `face-S`, rank: null }
  const n = Number(s)
  if (!Number.isFinite(n) || n < 1 || n > 12) return null
  return { id: `face-${n}`, rank: n as SkippoRank }
}
