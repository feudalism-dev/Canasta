import type { Card } from '../cards'
import { canLayOff, classifyMeld } from './melds'
import { deadwoodPoints } from './score'
import type { RummyConfig, RummyMeld } from './types'

export type HandPartition = {
  melds: { kind: 'set' | 'run'; cards: Card[] }[]
  deadwood: Card[]
  points: number
}

/** All legal melds (size 3–4 for sets; 3+ for runs) inside `hand`. */
export function enumerateMelds(hand: Card[]): { kind: 'set' | 'run'; cards: Card[] }[] {
  const out: { kind: 'set' | 'run'; cards: Card[] }[] = []
  const n = hand.length
  if (n < 3) return out
  const maxLen = Math.min(n, 6)
  for (let len = 3; len <= maxLen; len++) {
    const idx: number[] = []
    const walk = (start: number, need: number) => {
      if (need === 0) {
        const cards = idx.map((i) => hand[i]!)
        const kind = classifyMeld(cards)
        if (kind === 'set' && cards.length <= 4) out.push({ kind, cards })
        if (kind === 'run') out.push({ kind, cards })
        return
      }
      for (let i = start; i <= n - need; i++) {
        idx.push(i)
        walk(i + 1, need - 1)
        idx.pop()
      }
    }
    walk(0, len)
  }
  return out
}

/**
 * Minimum deadwood arrangement of a hand (Gin / knock evaluation).
 * Exhaustive over meld combinations — fine for ≤11 cards.
 */
export function bestPartition(hand: Card[], config: RummyConfig): HandPartition {
  const candidates = enumerateMelds(hand)
  let best: HandPartition = {
    melds: [],
    deadwood: [...hand],
    points: hand.reduce((s, c) => s + deadwoodPoints(c, config), 0),
  }

  const chosen: { kind: 'set' | 'run'; cards: Card[] }[] = []
  const search = (from: number) => {
    const used = new Set<string>()
    for (const m of chosen) for (const c of m.cards) used.add(c.id)
    const leftover = hand.filter((c) => !used.has(c.id))
    const points = leftover.reduce((s, c) => s + deadwoodPoints(c, config), 0)
    if (points < best.points) {
      best = {
        melds: chosen.map((m) => ({ kind: m.kind, cards: [...m.cards] })),
        deadwood: leftover,
        points,
      }
    }
    if (points === 0) return
    for (let i = from; i < candidates.length; i++) {
      const m = candidates[i]!
      if (m.cards.some((c) => used.has(c.id))) continue
      chosen.push(m)
      search(i + 1)
      chosen.pop()
    }
  }
  search(0)
  return best
}

/** Deadwood after discarding `discardId` from an 11-card (post-draw) hand. */
export function partitionAfterDiscard(
  hand: Card[],
  discardId: string,
  config: RummyConfig,
): HandPartition | null {
  if (!hand.some((c) => c.id === discardId)) return null
  const kept = hand.filter((c) => c.id !== discardId)
  return bestPartition(kept, config)
}

export function canKnockWithDiscard(
  hand: Card[],
  discardId: string,
  config: RummyConfig,
): { ok: true; partition: HandPartition; gin: boolean } | { ok: false; error: string } {
  if (config.variant !== 'gin') return { ok: false, error: 'Knock is Gin only' }
  const part = partitionAfterDiscard(hand, discardId, config)
  if (!part) return { ok: false, error: 'Card not in hand' }
  const max = config.knockMax ?? 10
  if (part.points > max) {
    return { ok: false, error: `Need ${max} or fewer deadwood to knock (have ${part.points})` }
  }
  return { ok: true, partition: part, gin: part.points === 0 }
}

/** Apply as many layoffs as possible from `hand` onto `melds` (greedy by points saved). */
export function autoLayoffs(
  hand: Card[],
  melds: RummyMeld[],
  config: RummyConfig,
): { hand: Card[]; melds: RummyMeld[]; laid: Card[] } {
  let rest = [...hand]
  const nextMelds = melds.map((m) => ({ ...m, cards: [...m.cards] }))
  const laid: Card[] = []
  let progressed = true
  while (progressed) {
    progressed = false
    let best: { card: Card; meldIndex: number; save: number } | null = null
    for (const card of rest) {
      for (let mi = 0; mi < nextMelds.length; mi++) {
        const m = nextMelds[mi]!
        const err = canLayOff(m.cards, m.kind, [card])
        if (err) continue
        const save = deadwoodPoints(card, config)
        if (!best || save > best.save) best = { card, meldIndex: mi, save }
      }
    }
    if (best) {
      const m = nextMelds[best.meldIndex]!
      m.cards = [...m.cards, best.card]
      rest = rest.filter((c) => c.id !== best!.card.id)
      laid.push(best.card)
      progressed = true
    }
  }
  return { hand: rest, melds: nextMelds, laid }
}
