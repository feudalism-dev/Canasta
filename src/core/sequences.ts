import { isRedThree, isWild, type Card, type Rank, type Suit } from './cards'
import type { Meld, VariantConfig } from './types'

function isSequenceMeld(meld: Meld): boolean {
  return meld.kind === 'sequence'
}

/** Natural ranks allowed in a Samba/Bolivia sequence (ace high, 4 low). */
export const SEQUENCE_RANKS: Rank[] = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const SEQUENCE_VALUE: Record<string, number> = Object.fromEntries(SEQUENCE_RANKS.map((r, i) => [r, i]))

export function naturalSequenceValue(rank: Rank): number | null {
  if (rank === '2' || rank === '3' || rank === 'JOKER') return null
  const v = SEQUENCE_VALUE[rank]
  return v === undefined ? null : v
}

export function sortSequenceCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const av = naturalSequenceValue(a.rank)
    const bv = naturalSequenceValue(b.rank)
    if (av === null || bv === null) return 0
    return av - bv
  })
}

export function isSequenceNatural(card: Card): boolean {
  return !isWild(card) && !isRedThree(card) && card.rank !== '3' && naturalSequenceValue(card.rank) !== null
}

export function validateSequenceCards(cards: Card[], config: VariantConfig): string | null {
  if (!config.sequencesEnabled) return 'Sequences are not allowed in this variant'
  if (cards.length < 3) return 'A sequence needs at least three cards'
  if (config.sequencesCloseAtSeven && cards.length > config.canastaSize) {
    return 'A sequence cannot exceed seven cards'
  }
  if (cards.some((c) => !isSequenceNatural(c))) return 'Sequences cannot include wilds or threes'
  const suit = cards[0]!.suit
  if (suit === 'J' || cards.some((c) => c.suit !== suit)) return 'Sequence cards must be the same suit'
  const sorted = sortSequenceCards(cards)
  for (let i = 1; i < sorted.length; i++) {
    const prev = naturalSequenceValue(sorted[i - 1]!.rank)
    const curr = naturalSequenceValue(sorted[i]!.rank)
    if (prev === null || curr === null || curr !== prev + 1) return 'Sequence ranks must be consecutive'
  }
  return null
}

/** True when meld is a completed seven-card sequence (samba / escalera). */
export function meldIsSamba(meld: Meld, size = 7): boolean {
  return isSequenceMeld(meld) && meld.cards.length >= size
}

export function buildSequenceMeld(cards: Card[], config: VariantConfig): { meld: Meld; error: string | null } {
  const err = validateSequenceCards(cards, config)
  if (err) return { meld: { rank: '4', cards: [], closed: false }, error: err }
  const sorted = sortSequenceCards(cards)
  const low = sorted[0]!
  const closed = config.sequencesCloseAtSeven && sorted.length >= config.canastaSize
  return {
    meld: {
      rank: low.rank as Meld['rank'],
      kind: 'sequence',
      suit: low.suit as Suit,
      cards: sorted,
      closed,
    },
    error: null,
  }
}

/** Whether a discard (or any card) fits on either end of an open sequence meld. */
export function sequenceAcceptsCard(meld: Meld, card: Card, config: VariantConfig): boolean {
  if (!isSequenceMeld(meld)) return false
  if (meld.closed) return false
  if (!isSequenceNatural(card)) return false
  if (meld.suit && card.suit !== meld.suit) return false
  const sorted = sortSequenceCards(meld.cards)
  const low = naturalSequenceValue(sorted[0]!.rank)
  const high = naturalSequenceValue(sorted[sorted.length - 1]!.rank)
  const cv = naturalSequenceValue(card.rank)
  if (low === null || high === null || cv === null) return false
  if (cv === low - 1 || cv === high + 1) {
    const trial = cv === low - 1 ? [card, ...sorted] : [...sorted, card]
    return !validateSequenceCards(trial, config)
  }
  return false
}

/** Fixed seven-card windows per suit (Pagat Samba). */
export const SAMBA_WINDOWS: { low: Rank; high: Rank }[] = [
  { low: '4', high: '10' },
  { low: '5', high: 'J' },
  { low: '6', high: 'Q' },
  { low: '7', high: 'K' },
  { low: '8', high: 'A' },
]

export function sequenceFitsSambaWindow(cards: Card[]): boolean {
  if (cards.length !== 7) return false
  const sorted = sortSequenceCards(cards)
  const low = sorted[0]!.rank
  const high = sorted[6]!.rank
  return SAMBA_WINDOWS.some((w) => w.low === low && w.high === high)
}

/** Maximal consecutive runs (3+ cards) per suit in a hand — for legal-move hints. */
export function findSequenceRuns(hand: Card[]): Card[][] {
  const runs: Card[][] = []
  for (const suit of ['H', 'D', 'S', 'C'] as const) {
    const naturals = hand.filter((c) => c.suit === suit && isSequenceNatural(c))
    if (naturals.length < 3) continue
    const sorted = sortSequenceCards(naturals)
    let run: Card[] = [sorted[0]!]
    for (let i = 1; i < sorted.length; i++) {
      const prev = naturalSequenceValue(sorted[i - 1]!.rank)
      const curr = naturalSequenceValue(sorted[i]!.rank)
      if (prev !== null && curr === prev + 1) {
        run.push(sorted[i]!)
      } else {
        if (run.length >= 3) runs.push([...run])
        run = [sorted[i]!]
      }
    }
    if (run.length >= 3) runs.push([...run])
  }
  return runs
}
