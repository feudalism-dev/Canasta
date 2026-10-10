import { mulberry32, shuffleInPlace } from '../rng'
import type { IchiCard, IchiColor, IchiKind, IchiVariant } from './types'

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

/** Flip deck: each card has a light face and a darker alt face; plus Flip cards. */
export function buildFlipDeck(): IchiCard[] {
  const out: IchiCard[] = []
  let n = 0
  const darkNum = (k: IchiKind): IchiKind => {
    if (k === '1') return '6'
    if (k === '2') return '7'
    if (k === '3') return '8'
    if (k === '4') return '9'
    if (k === '5') return '5'
    return k
  }
  for (const color of ICHI_COLORS) {
    for (const kind of ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as IchiKind[]) {
      out.push({
        id: `f${n++}`,
        color,
        kind,
        darkColor: color,
        darkKind: darkNum(kind),
      })
      out.push({
        id: `f${n++}`,
        color,
        kind,
        darkColor: color,
        darkKind: darkNum(kind),
      })
    }
    for (const kind of ACTION_KINDS) {
      const darkKind: IchiKind = kind === 'draw2' ? 'wdf' : kind
      out.push({
        id: `f${n++}`,
        color,
        kind,
        darkColor: color,
        darkKind,
      })
    }
  }
  for (let i = 0; i < 4; i++) {
    out.push({
      id: `f${n++}`,
      color: null,
      kind: 'wild',
      darkColor: null,
      darkKind: 'wild',
    })
    out.push({
      id: `f${n++}`,
      color: null,
      kind: 'wdf',
      darkColor: null,
      darkKind: 'wdf',
    })
    out.push({
      id: `f${n++}`,
      color: null,
      kind: 'flip',
      darkColor: null,
      darkKind: 'flip',
    })
  }
  return out
}

export function shuffleDeck(cards: IchiCard[], seed: number): IchiCard[] {
  return shuffleInPlace([...cards], mulberry32(seed))
}

export function shuffleIchiDeck(seed: number): IchiCard[] {
  return shuffleDeck(buildIchiDeck(), seed)
}

export function deckForVariant(variant: IchiVariant): IchiCard[] {
  if (variant === 'flip') return buildFlipDeck()
  return buildIchiDeck()
}

export function isWild(card: IchiCard, side: 'light' | 'dark' = 'light'): boolean {
  const k = faceKind(card, side)
  return k === 'wild' || k === 'wdf'
}

export function isNumber(card: IchiCard, side: 'light' | 'dark' = 'light'): boolean {
  return NUMBER_KINDS.includes(faceKind(card, side))
}

export function faceKind(card: IchiCard, side: 'light' | 'dark' = 'light'): IchiKind {
  if (side === 'dark' && card.darkKind) return card.darkKind
  return card.kind
}

export function faceColor(card: IchiCard, side: 'light' | 'dark' = 'light'): IchiColor | null {
  if (side === 'dark' && card.darkColor !== undefined) return card.darkColor
  return card.color
}

export function cardPoints(card: IchiCard, side: 'light' | 'dark' = 'light'): number {
  const k = faceKind(card, side)
  if (k === 'wild' || k === 'wdf' || k === 'flip') return 50
  if (k === 'skip' || k === 'reverse' || k === 'draw2') return 20
  return Number(k) || 0
}

/** Palace ranking: higher can cover lower. 2 resets; wild burns. */
export function palaceRank(card: IchiCard): number {
  if (card.kind === 'wild' || card.kind === 'wdf') return 100
  if (card.kind === '2') return 2
  if (card.kind === 'skip') return 11
  if (card.kind === 'reverse') return 12
  if (card.kind === 'draw2') return 13
  return Number(card.kind)
}

export function kindLabel(kind: IchiKind): string {
  if (kind === 'skip') return 'Skip'
  if (kind === 'reverse') return 'Rev'
  if (kind === 'draw2') return '+2'
  if (kind === 'wild') return 'Wild'
  if (kind === 'wdf') return '+4'
  if (kind === 'flip') return 'Flip'
  return kind
}

export function colorLabel(c: IchiColor): string {
  if (c === 'R') return 'Red'
  if (c === 'Y') return 'Yellow'
  if (c === 'G') return 'Green'
  return 'Blue'
}

export function sortIchiHand(hand: IchiCard[], side: 'light' | 'dark' = 'light'): IchiCard[] {
  const order = (c: IchiCard) => {
    const col = faceColor(c, side)
    const kind = faceKind(c, side)
    const ci = col ? ICHI_COLORS.indexOf(col) : 4
    const ki =
      kind === 'wild'
        ? 20
        : kind === 'wdf'
          ? 21
          : kind === 'flip'
            ? 22
            : kind === 'skip'
              ? 12
              : kind === 'reverse'
                ? 13
                : kind === 'draw2'
                  ? 14
                  : Number(kind)
    return ci * 30 + ki
  }
  return [...hand].sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id))
}

export function encodeIchiFace(card: IchiCard, side: 'light' | 'dark' = 'light'): string {
  const kind = faceKind(card, side)
  let k: string = kind
  if (kind === 'skip') k = 'S'
  else if (kind === 'reverse') k = 'V'
  else if (kind === 'draw2') k = 'D'
  else if (kind === 'wild') k = 'W'
  else if (kind === 'wdf') k = 'F'
  else if (kind === 'flip') k = 'P'
  const col = faceColor(card, side) ?? 'X'
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
  else if (kCh === 'P') kind = 'flip'
  if (!kind) return null
  const wildish = kind === 'wild' || kind === 'wdf' || kind === 'flip'
  const color =
    colCh === 'X' || wildish ? null : 'RYGB'.includes(colCh) ? (colCh as IchiColor) : null
  if (!wildish && !color) return null
  return { id: `face-${raw}`, color, kind }
}
