import { isNumber, isSkip, isWild } from './deck'
import type { PhasePart } from './phases'
import type { PhaseItCard, PhaseItColor, PhaseItMeld } from './types'

function numbersOf(cards: PhaseItCard[]): number[] {
  return cards.filter((c) => isNumber(c)).map((c) => c.kind as number)
}

export function isValidSet(cards: PhaseItCard[], size: number): boolean {
  if (cards.length !== size) return false
  if (cards.some(isSkip)) return false
  const nums = numbersOf(cards)
  const wilds = cards.filter(isWild).length
  if (nums.length + wilds !== size) return false
  if (nums.length === 0) return wilds === size // all wilds ok as a set
  const rank = nums[0]!
  return nums.every((n) => n === rank)
}

/** Runs: consecutive numbers; wilds fill gaps. Same color not required (classic Phase 10). */
export function isValidRun(cards: PhaseItCard[], length: number): boolean {
  if (cards.length !== length) return false
  if (cards.some(isSkip)) return false
  const wilds = cards.filter(isWild).length
  const nums = numbersOf(cards).sort((a, b) => a - b)
  if (nums.length + wilds !== length) return false
  if (nums.length === 0) return wilds === length

  // Try to place numbers into a window of `length` consecutive ranks
  for (let start = 1; start <= 13 - length; start++) {
    const need = new Set<number>()
    for (let i = 0; i < length; i++) need.add(start + i)
    let usedWild = 0
    let ok = true
    const remaining = [...nums]
    for (const n of [...need].sort((a, b) => a - b)) {
      const idx = remaining.indexOf(n)
      if (idx >= 0) remaining.splice(idx, 1)
      else {
        usedWild++
        if (usedWild > wilds) {
          ok = false
          break
        }
      }
    }
    if (ok && remaining.length === 0 && usedWild <= wilds) return true
  }
  return false
}

export function isValidColor(cards: PhaseItCard[], count: number): boolean {
  if (cards.length !== count) return false
  if (cards.some(isSkip)) return false
  const colored = cards.filter((c) => c.color != null)
  const wilds = cards.filter(isWild).length
  if (colored.length + wilds !== count) return false
  if (colored.length === 0) return wilds === count
  const col = colored[0]!.color as PhaseItColor
  return colored.every((c) => c.color === col)
}

export function classifyMeld(cards: PhaseItCard[], part: PhasePart): PhaseItMeld | null {
  if (part.t === 'set' && isValidSet(cards, part.size)) {
    return { cards, kind: 'set' }
  }
  if (part.t === 'run' && isValidRun(cards, part.length)) {
    return { cards, kind: 'run' }
  }
  if (part.t === 'color' && isValidColor(cards, part.count)) {
    return { cards, kind: 'color' }
  }
  return null
}

/** Try to match groups to parts (order-sensitive first, then permute). */
export function matchPhaseGroups(
  groups: PhaseItCard[][],
  parts: PhasePart[],
): PhaseItMeld[] | null {
  if (groups.length !== parts.length) return null

  const tryOrder = (order: number[]): PhaseItMeld[] | null => {
    const melds: PhaseItMeld[] = []
    for (let i = 0; i < parts.length; i++) {
      const meld = classifyMeld(groups[order[i]!]!, parts[i]!)
      if (!meld) return null
      melds.push(meld)
    }
    return melds
  }

  // Identity
  const id = tryOrder(parts.map((_, i) => i))
  if (id) return id

  // Permutations for up to 3 parts
  if (parts.length === 2) {
    return tryOrder([1, 0])
  }
  if (parts.length === 3) {
    const perms = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ]
    for (const p of perms) {
      const hit = tryOrder(p)
      if (hit) return hit
    }
  }
  return null
}

export function canHitMeld(meld: PhaseItMeld, card: PhaseItCard): boolean {
  if (isSkip(card)) return false
  if (meld.kind === 'set') {
    return isValidSet([...meld.cards, card], meld.cards.length + 1)
  }
  if (meld.kind === 'run') {
    // Try append/prepend by testing full list sorted by attempted positions
    const n = meld.cards.length + 1
    // Try all insertion points
    for (let i = 0; i <= meld.cards.length; i++) {
      const next = [...meld.cards.slice(0, i), card, ...meld.cards.slice(i)]
      if (isValidRun(next, n)) return true
    }
    return false
  }
  if (meld.kind === 'color') {
    return isValidColor([...meld.cards, card], meld.cards.length + 1)
  }
  return false
}

export function hitMeld(meld: PhaseItMeld, card: PhaseItCard): PhaseItMeld | null {
  if (!canHitMeld(meld, card)) return null
  if (meld.kind === 'set' || meld.kind === 'color') {
    return { ...meld, cards: [...meld.cards, card] }
  }
  // run — find a valid insertion
  for (let i = 0; i <= meld.cards.length; i++) {
    const next = [...meld.cards.slice(0, i), card, ...meld.cards.slice(i)]
    if (isValidRun(next, next.length)) return { kind: 'run', cards: next }
  }
  return null
}

/** Heuristic: find card-id groups that satisfy phase parts (for bot / suggest). */
export function findPhaseGroups(hand: PhaseItCard[], parts: PhasePart[]): string[][] | null {
  const available = [...hand]
  const groups: PhaseItCard[][] = []

  const take = (cards: PhaseItCard[]) => {
    for (const c of cards) {
      const idx = available.findIndex((x) => x.id === c.id)
      if (idx < 0) return false
      available.splice(idx, 1)
    }
    return true
  }

  for (const part of parts) {
    const found = findOnePart(available, part)
    if (!found || !take(found)) return null
    groups.push(found)
  }
  return groups.map((g) => g.map((c) => c.id))
}

function findOnePart(pool: PhaseItCard[], part: PhasePart): PhaseItCard[] | null {
  if (part.t === 'set') return findSet(pool, part.size)
  if (part.t === 'run') return findRun(pool, part.length)
  return findColor(pool, part.count)
}

function findSet(pool: PhaseItCard[], size: number): PhaseItCard[] | null {
  const wilds = pool.filter(isWild)
  const byRank = new Map<number, PhaseItCard[]>()
  for (const c of pool) {
    if (!isNumber(c)) continue
    const r = c.kind as number
    const list = byRank.get(r) ?? []
    list.push(c)
    byRank.set(r, list)
  }
  let best: PhaseItCard[] | null = null
  for (const [, cards] of byRank) {
    if (cards.length >= size) {
      const pick = cards.slice(0, size)
      if (!best || pick.filter(isWild).length < best.filter(isWild).length) best = pick
      continue
    }
    const need = size - cards.length
    if (need > 0 && need <= wilds.length) {
      const pick = [...cards, ...wilds.slice(0, need)]
      if (isValidSet(pick, size) && (!best || need < best.filter(isWild).length)) best = pick
    }
  }
  if (!best && wilds.length >= size) best = wilds.slice(0, size)
  return best
}

function findRun(pool: PhaseItCard[], length: number): PhaseItCard[] | null {
  const wilds = pool.filter(isWild)
  const nums = pool.filter(isNumber)
  for (let start = 1; start <= 13 - length; start++) {
    const needRanks = Array.from({ length }, (_, i) => start + i)
    const used: PhaseItCard[] = []
    let wildNeed = 0
    const remaining = [...nums]
    for (const r of needRanks) {
      const idx = remaining.findIndex((c) => c.kind === r)
      if (idx >= 0) {
        used.push(remaining[idx]!)
        remaining.splice(idx, 1)
      } else {
        wildNeed++
      }
    }
    if (wildNeed <= wilds.length) {
      const pick = [...used, ...wilds.slice(0, wildNeed)]
      if (isValidRun(pick, length)) return pick
    }
  }
  return null
}

function findColor(pool: PhaseItCard[], count: number): PhaseItCard[] | null {
  const wilds = pool.filter(isWild)
  const byCol = new Map<PhaseItColor, PhaseItCard[]>()
  for (const c of pool) {
    if (!c.color) continue
    const list = byCol.get(c.color) ?? []
    list.push(c)
    byCol.set(c.color, list)
  }
  let best: PhaseItCard[] | null = null
  for (const [, cards] of byCol) {
    if (cards.length >= count) {
      const pick = cards.slice(0, count)
      if (!best) best = pick
      continue
    }
    const need = count - cards.length
    if (need > 0 && need <= wilds.length) {
      const pick = [...cards, ...wilds.slice(0, need)]
      if (isValidColor(pick, count) && (!best || need < (best.filter(isWild).length))) best = pick
    }
  }
  if (!best && wilds.length >= count) best = wilds.slice(0, count)
  return best
}
