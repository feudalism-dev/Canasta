import type { MeldRank, Rank, Suit } from './cards'
import type { PublicBoard, PublicMeld } from './publicBoard'

export type TableFlightPlan = {
  kind: 'meld' | 'discard' | 'takePile' | 'draw'
  from: 'seat' | 'discard' | 'stock'
  to: 'seat' | 'discard' | 'meld'
  seat: number
  team?: 0 | 1
  rank?: MeldRank
  count: number
  top?: { rank: Rank; suit: Suit }
}

const MAX_CARDS = 4

function actingSeat(prev: PublicBoard, next: PublicBoard): number {
  if (prev.currentSeat >= 0) return prev.currentSeat
  return next.currentSeat
}

function addedToTeam(prev: PublicMeld[], next: PublicMeld[]): { rank: MeldRank; added: number; kind: PublicMeld['kind'] }[] {
  const used = new Set<number>()
  const out: { rank: MeldRank; added: number; kind: PublicMeld['kind'] }[] = []
  for (const m of next) {
    const idx = prev.findIndex((p, i) => p.rank === m.rank && !used.has(i))
    if (idx >= 0) {
      used.add(idx)
      const before = prev[idx]!
      if (m.count > before.count) out.push({ rank: m.rank, added: m.count - before.count, kind: m.kind })
    } else {
      out.push({ rank: m.rank, added: m.count, kind: m.kind })
    }
  }
  return out
}

export function planTableFlights(prev: PublicBoard, next: PublicBoard): TableFlightPlan[] {
  if (!prev.live || !next.live) return []
  if (prev.round !== next.round) return []
  const seat = actingSeat(prev, next)
  if (seat < 0) return []
  const team = (seat % 2 === 0 ? 0 : 1) as 0 | 1
  const tookPile = next.discardCount < prev.discardCount
  const drew = !tookPile && next.stock < prev.stock
  const topChanged = Boolean(
    next.top &&
      (!prev.top || next.top.rank !== prev.top.rank || next.top.suit !== prev.top.suit),
  )
  const discarded = Boolean(next.top) && (next.discardCount > prev.discardCount || topChanged)
  const plans: TableFlightPlan[] = []

  if (drew) {
    plans.push({
      kind: 'draw',
      from: 'stock',
      to: 'seat',
      seat,
      count: Math.min(MAX_CARDS, Math.max(1, prev.stock - next.stock)),
    })
  }
  if (tookPile) {
    plans.push({
      kind: 'takePile',
      from: 'discard',
      to: 'seat',
      seat,
      count: Math.min(MAX_CARDS, Math.max(1, prev.discardCount - next.discardCount)),
    })
  }

  for (const add of addedToTeam(prev.teams[team]!.melds, next.teams[team]!.melds)) {
    plans.push({
      kind: 'meld',
      from: 'seat',
      to: 'meld',
      seat,
      team,
      rank: add.rank,
      count: Math.min(MAX_CARDS, Math.max(1, add.added)),
    })
  }

  if (discarded) {
    plans.push({
      kind: 'discard',
      from: 'seat',
      to: 'discard',
      seat,
      count: 1,
      top: next.top ?? undefined,
    })
  }
  return plans
}
