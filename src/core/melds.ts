import { cardPoints, isWild, type Card, type MeldRank } from './cards'
import type { Meld, VariantConfig } from './types'

export function naturalCount(meld: Meld): number {
  return meld.cards.filter((c) => !isWild(c)).length
}

export function wildCount(meld: Meld): number {
  return meld.cards.filter((c) => isWild(c)).length
}

export function meldIsNatural(meld: Meld): boolean {
  return wildCount(meld) === 0 && meld.cards.length > 0
}

export function meldIsCanasta(meld: Meld, size: number): boolean {
  return meld.cards.length >= size
}

export function meldIsWildBook(meld: Meld): boolean {
  return meld.rank === 'WILD' || (meld.cards.length > 0 && meld.cards.every((c) => isWild(c)))
}

export function canastaKind(meld: Meld, size: number): 'none' | 'natural' | 'mixed' | 'wild' {
  if (meld.cards.length < size) return 'none'
  if (meldIsWildBook(meld)) return 'wild'
  if (meldIsNatural(meld)) return 'natural'
  return 'mixed'
}

export function meldPoints(meld: Meld): number {
  return meld.cards.reduce((n, c) => n + cardPoints(c), 0)
}

export function validateMeldCards(cards: Card[], rank: MeldRank, config: VariantConfig): string | null {
  if (cards.length < 3 && rank !== '3') {
    return 'A meld needs at least three cards'
  }
  if (rank === 'WILD') {
    if (!config.house.wildBooksAllowed) return 'Wild books are not allowed'
    if (!cards.every((c) => isWild(c))) return 'A wild book is only 2s and jokers'
    if (config.booksCloseAtSeven && cards.length > config.canastaSize) return 'A book cannot exceed seven'
    return null
  }
  if (rank === '3') {
    if (cards.some((c) => c.rank !== '3' || isWild(c))) return 'Black threes cannot mix with wilds'
    if (cards.some((c) => c.suit === 'H' || c.suit === 'D')) return 'Red threes cannot be melded as a rank'
    if (cards.length < 3) return 'Need three or four black threes'
    return null
  }
  const naturals = cards.filter((c) => !isWild(c))
  const wilds = cards.filter((c) => isWild(c))
  if (naturals.some((c) => c.rank !== rank)) return 'Those cards are not the same rank'
  if (naturals.length < config.minNaturalsToStart && cards.length >= 3) {
    if (naturals.length < 2) return 'A meld needs at least two natural cards'
  }
  if (naturals.length < 2) return 'A meld needs at least two natural cards'
  if (wilds.length > config.maxWildsPerMeld) return `At most ${config.maxWildsPerMeld} wilds in a meld`
  if (config.booksCloseAtSeven && cards.length > config.canastaSize) return 'A book cannot exceed seven'
  return null
}

export function inferMeldRank(cards: Card[]): MeldRank | null {
  if (cards.length === 0) return null
  if (cards.every((c) => isWild(c))) return 'WILD'
  const naturals = cards.filter((c) => !isWild(c))
  if (naturals.length === 0) return 'WILD'
  if (naturals.every((c) => c.rank === '3')) return '3'
  const rank = naturals[0]!.rank
  if (rank === '2' || rank === 'JOKER' || rank === '3') return null
  if (naturals.some((c) => c.rank !== rank)) return null
  return rank as MeldRank
}

export function wouldClose(meld: Meld, adding: number, config: VariantConfig): boolean {
  const n = meld.cards.length + adding
  if (!config.booksCloseAtSeven) return n >= config.canastaSize && meld.closed
  return n >= config.canastaSize
}

export function canAddCards(meld: Meld, cards: Card[], config: VariantConfig): string | null {
  if (cards.length === 0) return 'Select cards to add'
  if (config.booksCloseAtSeven && meld.closed) return 'That book is already closed'
  const combined = [...meld.cards, ...cards]
  if (config.booksCloseAtSeven && combined.length > config.canastaSize) return 'A book cannot exceed seven'
  if (meld.rank === 'WILD') {
    if (!cards.every((c) => isWild(c))) return 'Only wilds can join a wild book'
    return validateMeldCards(combined, 'WILD', config)
  }
  if (meld.rank === '3') return 'Cannot add to a black-three meld'
  for (const c of cards) {
    if (isWild(c)) continue
    if (c.rank !== meld.rank) return 'That card does not match the meld'
  }
  const wilds = combined.filter((c) => isWild(c)).length
  if (wilds > config.maxWildsPerMeld) return `At most ${config.maxWildsPerMeld} wilds in a meld`
  const naturals = combined.filter((c) => !isWild(c)).length
  if (naturals < 2) return 'A meld needs at least two natural cards'
  if (config.booksCloseAtSeven && combined.length === config.canastaSize) {
    const dirtyNaturals = combined.filter((c) => !isWild(c)).length
    if (wilds > 0 && dirtyNaturals < config.minNaturalsForDirtyBook) {
      return 'A dirty book needs at least four natural cards'
    }
  }
  return null
}

export function closeIfNeeded(meld: Meld, config: VariantConfig): Meld {
  if (!config.booksCloseAtSeven) {
    return { ...meld, closed: meld.cards.length >= config.canastaSize ? meld.closed : meld.closed }
  }
  if (meld.cards.length >= config.canastaSize) return { ...meld, closed: true }
  return meld
}

export function teamCanastaCounts(melds: Meld[], size: number): { clean: number; dirty: number; wild: number } {
  let clean = 0
  let dirty = 0
  let wild = 0
  for (const m of melds) {
    const kind = canastaKind(m, size)
    if (kind === 'natural') clean++
    else if (kind === 'mixed') dirty++
    else if (kind === 'wild') wild++
  }
  return { clean, dirty, wild }
}
