import { mulberry32, shuffleInPlace } from '../rng'
import type { PhaseItCard, PhaseItColor, PhaseItKind } from './types'

export const PHASEIT_COLORS: PhaseItColor[] = ['R', 'Y', 'G', 'B']

const NUMBERS: PhaseItKind[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** 96 number cards (4 colors × 12 × 2) + 8 wild + 4 skip = 108. */
export function buildPhaseItDeck(): PhaseItCard[] {
  const cards: PhaseItCard[] = []
  let n = 0
  for (const color of PHASEIT_COLORS) {
    for (const kind of NUMBERS) {
      for (let copy = 0; copy < 2; copy++) {
        cards.push({ id: `p${n++}`, color, kind })
      }
    }
  }
  for (let i = 0; i < 8; i++) cards.push({ id: `p${n++}`, color: null, kind: 'wild' })
  for (let i = 0; i < 4; i++) cards.push({ id: `p${n++}`, color: null, kind: 'skip' })
  return cards
}

export function shuffleDeck(deck: PhaseItCard[], seed: number): PhaseItCard[] {
  return shuffleInPlace([...deck], mulberry32(seed))
}

export function isWild(card: PhaseItCard): boolean {
  return card.kind === 'wild'
}

export function isSkip(card: PhaseItCard): boolean {
  return card.kind === 'skip'
}

export function isNumber(card: PhaseItCard): boolean {
  return typeof card.kind === 'number'
}

export function cardPoints(card: PhaseItCard): number {
  if (card.kind === 'skip' || card.kind === 'wild') return 25
  if (typeof card.kind === 'number' && card.kind >= 10) return 10
  return 5
}

export function cardLabel(card: PhaseItCard): string {
  if (card.kind === 'wild') return 'WILD'
  if (card.kind === 'skip') return 'Skip'
  return String(card.kind)
}

export function colorLabel(c: PhaseItColor): string {
  if (c === 'R') return 'Red'
  if (c === 'Y') return 'Yellow'
  if (c === 'G') return 'Green'
  return 'Blue'
}

export function sortPhaseItHand(hand: PhaseItCard[]): PhaseItCard[] {
  return [...hand].sort((a, b) => {
    const wa = a.kind === 'wild' ? 100 : a.kind === 'skip' ? 101 : (a.kind as number)
    const wb = b.kind === 'wild' ? 100 : b.kind === 'skip' ? 101 : (b.kind as number)
    if (wa !== wb) return wa - wb
    const ca = a.color ?? 'Z'
    const cb = b.color ?? 'Z'
    if (ca !== cb) return ca.localeCompare(cb)
    return a.id.localeCompare(b.id)
  })
}

export function encodePhaseItFace(card: PhaseItCard): string {
  if (card.kind === 'wild') return 'XW'
  if (card.kind === 'skip') return 'XS'
  return `${card.color ?? 'X'}${card.kind}`
}

export function parsePhaseItFace(raw: string): PhaseItCard | null {
  const s = raw.trim()
  if (!s || s === '-') return null
  if (s === 'XW') return { id: 'face-W', color: null, kind: 'wild' }
  if (s === 'XS') return { id: 'face-S', color: null, kind: 'skip' }
  const col = s[0]
  const num = Number(s.slice(1))
  if (!PHASEIT_COLORS.includes(col as PhaseItColor) || !Number.isFinite(num)) return null
  return { id: `face-${s}`, color: col as PhaseItColor, kind: num as PhaseItKind }
}
