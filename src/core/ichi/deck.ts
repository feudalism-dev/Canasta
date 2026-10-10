import { mulberry32, shuffleInPlace } from '../rng'
import type { IchiCard, IchiColor, IchiKind } from './types'

export const ICHI_COLORS: IchiColor[] = ['R', 'Y', 'G', 'B']

const NUMBER_KINDS: IchiKind[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const ACTION_KINDS: IchiKind[] = ['skip', 'reverse', 'draw2']

export function buildIchiDeck(): IchiCard[] {
  const out: IchiCard[] = []
  let n = 0
  for (const color of ICHI_COLORS) {
    out.push({ id: `i${n++}`, color, kind: '0' })
    for (const kind of NUMBER_KINDS.slice(1)) {
      out.push({ id: `i${n++}`, color, kind })
      out.push({ id: `i${n++}`, color, kind })
    }
    for (const kind of ACTION_KINDS) {
      out.push({ id: `i${n++}`, color, kind })
      out.push({ id: `i${n++}`, color, kind })
    }
  }
  for (let i = 0; i < 4; i++) {
    out.push({ id: `i${n++}`, color: null, kind: 'wild' })
    out.push({ id: `i${n++}`, color: null, kind: 'wdf' })
  }
  return out
}

export function shuffleIchiDeck(seed: number): IchiCard[] {
  return shuffleInPlace(buildIchiDeck(), mulberry32(seed))
}

export function isWild(card: IchiCard): boolean {
  return card.kind === 'wild' || card.kind === 'wdf'
}

export function isNumber(card: IchiCard): boolean {
  return NUMBER_KINDS.includes(card.kind)
}

export function cardPoints(card: IchiCard): number {
  if (card.kind === 'wild' || card.kind === 'wdf') return 50
  if (card.kind === 'skip' || card.kind === 'reverse' || card.kind === 'draw2') return 20
  return Number(card.kind)
}

export function kindLabel(kind: IchiKind): string {
  if (kind === 'skip') return 'Skip'
  if (kind === 'reverse') return 'Reverse'
  if (kind === 'draw2') return '+2'
  if (kind === 'wild') return 'Wild'
  if (kind === 'wdf') return '+4'
  return kind
}

export function colorLabel(c: IchiColor): string {
  if (c === 'R') return 'Red'
  if (c === 'Y') return 'Yellow'
  if (c === 'G') return 'Green'
  return 'Blue'
}

export function sortIchiHand(hand: IchiCard[]): IchiCard[] {
  const order = (c: IchiCard) => {
    const ci = c.color ? ICHI_COLORS.indexOf(c.color) : 4
    const ki =
      c.kind === 'wild'
        ? 20
        : c.kind === 'wdf'
          ? 21
          : c.kind === 'skip'
            ? 12
            : c.kind === 'reverse'
              ? 13
              : c.kind === 'draw2'
                ? 14
                : Number(c.kind)
    return ci * 30 + ki
  }
  return [...hand].sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id))
}

/** Encode face for BOARD wire: kindChar + colorChar (W/F for wilds, color X). */
export function encodeIchiFace(card: IchiCard): string {
  let k = card.kind
  if (k === 'skip') k = 'S' as IchiKind
  else if (k === 'reverse') k = 'V' as IchiKind
  else if (k === 'draw2') k = 'D' as IchiKind
  else if (k === 'wild') k = 'W' as IchiKind
  else if (k === 'wdf') k = 'F' as IchiKind
  const col = card.color ?? 'X'
  return `${k}${col}`
}

export function parseIchiFace(raw: string): IchiCard | null {
  if (raw.length < 2) return null
  const kCh = raw[0]!
  const colCh = raw[1]!
  let kind: IchiKind | null = null
  if ('0123456789'.includes(kCh)) kind = kCh as IchiKind
  else if (kCh === 'S') kind = 'skip'
  else if (kCh === 'V') kind = 'reverse'
  else if (kCh === 'D') kind = 'draw2'
  else if (kCh === 'W') kind = 'wild'
  else if (kCh === 'F') kind = 'wdf'
  if (!kind) return null
  const color =
    colCh === 'X' || isWild({ id: '', color: null, kind })
      ? null
      : ('RYGB'.includes(colCh) ? (colCh as IchiColor) : null)
  if (!isWild({ id: '', color: null, kind }) && !color) return null
  return { id: `face-${raw}`, color, kind }
}
