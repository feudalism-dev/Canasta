import { cardPoints, isRedThree, isWild, meldCountPoints, type Card, type MeldRank } from './cards'
import { validateSequenceCards } from './sequences'
import type { Meld, VariantConfig } from './types'

export function meldKind(meld: Meld): 'group' | 'sequence' {
  return meld.kind === 'sequence' ? 'sequence' : 'group'
}

export function isGroupMeld(meld: Meld): boolean {
  return meldKind(meld) === 'group'
}

export function isSequenceMeld(meld: Meld): boolean {
  return meld.kind === 'sequence'
}

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
  if (isSequenceMeld(meld)) return false
  return meld.cards.length >= size
}

function meldRankSortValue(rank: MeldRank): number {
  const order: Record<string, number> = {
    '4': 1,
    '5': 2,
    '6': 3,
    '7': 4,
    '8': 5,
    '9': 6,
    '10': 7,
    J: 8,
    Q: 9,
    K: 10,
    A: 11,
    '3': 12,
    WILD: 13,
  }
  return order[rank] ?? 99
}

/** Display order: completed canastas, then larger melds, then 4 through Ace. */
export function sortMeldsForDisplay(melds: Meld[], canastaSize: number): { meld: Meld; index: number }[] {
  return melds
    .map((meld, index) => ({ meld, index }))
    .sort((a, b) => {
      const aSeq = isSequenceMeld(a.meld)
      const bSeq = isSequenceMeld(b.meld)
      if (aSeq !== bSeq) return aSeq ? 1 : -1
      const aDone = aSeq ? (a.meld.closed ? 0 : 1) : meldIsCanasta(a.meld, canastaSize) ? 0 : 1
      const bDone = bSeq ? (b.meld.closed ? 0 : 1) : meldIsCanasta(b.meld, canastaSize) ? 0 : 1
      if (aDone !== bDone) return aDone - bDone
      const byCount = b.meld.cards.length - a.meld.cards.length
      if (byCount !== 0) return byCount
      if (aSeq && bSeq && a.meld.suit && b.meld.suit && a.meld.suit !== b.meld.suit) {
        return a.meld.suit.localeCompare(b.meld.suit)
      }
      return meldRankSortValue(a.meld.rank) - meldRankSortValue(b.meld.rank)
    })
}

export function meldIsWildBook(meld: Meld): boolean {
  if (isSequenceMeld(meld)) return false
  return meld.rank === 'WILD' || (meld.cards.length > 0 && meld.cards.every((c) => isWild(c)))
}

export function canastaKind(meld: Meld, size: number): 'none' | 'natural' | 'mixed' | 'wild' {
  if (isSequenceMeld(meld)) return 'none'
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
    if (bookIsCappedAtSeven(config) && cards.length > config.canastaSize) return 'A book cannot exceed seven'
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
  if (bookIsCappedAtSeven(config) && cards.length > config.canastaSize) return 'A book cannot exceed seven'
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

function attachSpareWild(groups: Card[][], wild: Card, config: VariantConfig): boolean {
  for (const g of groups) {
    const rank = inferMeldRank(g)
    if (!rank || rank === 'WILD' || rank === '3') continue
    const trial = [...g, wild]
    if (!validateMeldCards(trial, rank, config)) {
      g.push(wild)
      return true
    }
  }
  return false
}

/** Split mixed cards into complete rank-sets, assigning wilds to pairs first. */
export function partitionMeldCards(cards: Card[], config: VariantConfig): { groups: Card[][]; error: string | null } {
  if (cards.length === 0) return { groups: [], error: 'Select cards to meld.' }
  const single = inferMeldRank(cards)
  if (single) {
    const err = validateMeldCards(cards, single, config)
    return err ? { groups: [], error: err } : { groups: [cards], error: null }
  }
  const wilds = cards.filter(isWild)
  const byRank = new Map<string, Card[]>()
  for (const c of cards) {
    if (isWild(c) || isRedThree(c)) continue
    const list = byRank.get(c.rank) ?? []
    list.push(c)
    byRank.set(c.rank, list)
  }
  const groups: Card[][] = []
  let wildLeft = [...wilds]
  for (const [, naturals] of byRank) {
    if (naturals.length >= 3) {
      groups.push([...naturals])
    } else if (naturals.length >= 2) {
      if (!wildLeft.length) return { groups: [], error: 'Need a wild for that pair.' }
      groups.push([...naturals, wildLeft.shift()!])
    } else if (naturals.length === 1) {
      return { groups: [], error: 'Each set needs at least two natural cards.' }
    }
  }
  wildLeft = wildLeft.filter((w) => {
    if (attachSpareWild(groups, w, config)) return false
    return true
  })
  if (wildLeft.length >= 3 && config.house.wildBooksAllowed) {
    groups.push(wildLeft)
    wildLeft = []
  }
  if (wildLeft.length) return { groups: [], error: 'Those extra wilds do not make a meld.' }
  if (!groups.length) return { groups: [], error: 'Those cards are not a meld.' }
  for (const g of groups) {
    const rank = inferMeldRank(g)
    if (!rank) return { groups: [], error: 'Those extra cards are not a meld.' }
    const err = validateMeldCards(g, rank, config)
    if (err) return { groups: [], error: err }
  }
  return { groups, error: null }
}

/** Build enough complete sets from a hand to meet an opening-meld point floor. */
export function planOpeningMeldGroups(hand: Card[], config: VariantConfig, need: number): Card[][] | null {
  const wilds = hand.filter(isWild)
  const byRank = new Map<string, Card[]>()
  for (const c of hand) {
    if (isWild(c) || isRedThree(c) || c.rank === '3') continue
    const list = byRank.get(c.rank) ?? []
    list.push(c)
    byRank.set(c.rank, list)
  }
  const triples: Card[][] = []
  const pairs: Card[][] = []
  for (const [, naturals] of byRank) {
    if (naturals.length >= 3) triples.push([...naturals])
    else if (naturals.length >= 2) pairs.push([...naturals])
  }
  const groups: Card[][] = triples.map((g) => [...g])
  const scoreOf = (packs: Card[][]) => packs.flat().reduce((n, c) => n + meldCountPoints(c), 0)
  if (groups.length && scoreOf(groups) >= need) return groups
  pairs.sort((a, b) => {
    const pa = a.reduce((n, c) => n + meldCountPoints(c), 0)
    const pb = b.reduce((n, c) => n + meldCountPoints(c), 0)
    return pb - pa
  })
  const wildLeft = [...wilds]
  for (const pair of pairs) {
    if (!wildLeft.length) break
    groups.push([...pair, wildLeft.shift()!])
    if (scoreOf(groups) >= need) break
  }
  while (wildLeft.length) {
    const w = wildLeft[0]!
    if (!attachSpareWild(groups, w, config)) break
    wildLeft.shift()
    if (scoreOf(groups) >= need) break
  }
  if (wildLeft.length >= 3 && config.house.wildBooksAllowed) {
    groups.push([...wildLeft])
  }
  if (!groups.length || scoreOf(groups) < need) return null
  return groups
}

export function bookIsCappedAtSeven(config: VariantConfig): boolean {
  return config.booksCloseAtSeven && !config.house.addToClosedBooks
}

export function meldAcceptsAdds(meld: Meld, config: VariantConfig): boolean {
  if (!config.booksCloseAtSeven || !meld.closed) return true
  return config.house.addToClosedBooks
}

export function wouldClose(meld: Meld, adding: number, config: VariantConfig): boolean {
  const n = meld.cards.length + adding
  if (!config.booksCloseAtSeven) return n >= config.canastaSize && meld.closed
  return n >= config.canastaSize
}

export function canAddCards(meld: Meld, cards: Card[], config: VariantConfig): string | null {
  if (cards.length === 0) return 'Select cards to add'
  if (isSequenceMeld(meld)) {
    if (!config.sequencesEnabled) return 'Sequences are not allowed in this variant'
    if (meld.closed) return 'That samba is complete'
    const combined = [...meld.cards, ...cards]
    return validateSequenceCards(combined, config)
  }
  if (!meldAcceptsAdds(meld, config)) return 'That book is already closed'
  const combined = [...meld.cards, ...cards]
  if (bookIsCappedAtSeven(config) && combined.length > config.canastaSize) return 'A book cannot exceed seven'
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
  if (config.booksCloseAtSeven && combined.length >= config.canastaSize) {
    const dirtyNaturals = combined.filter((c) => !isWild(c)).length
    if (wilds > 0 && dirtyNaturals < config.minNaturalsForDirtyBook) {
      return 'A dirty book needs at least four natural cards'
    }
  }
  return null
}

export function closeIfNeeded(meld: Meld, config: VariantConfig): Meld {
  if (isSequenceMeld(meld)) {
    if (config.sequencesCloseAtSeven && meld.cards.length >= config.canastaSize) {
      return { ...meld, closed: true }
    }
    return meld
  }
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
