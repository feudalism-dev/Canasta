import { mulberry32 } from '../rng'
import type { YotsyDie, YotsyDieColor } from './types'

export function freshDice(): YotsyDie[] {
  return [0, 1, 2, 3, 4].map((i) => ({ id: `d${i}`, value: 1, held: false }))
}

export function rollDice(dice: YotsyDie[], seed: number): YotsyDie[] {
  const rng = mulberry32(seed)
  return dice.map((d) => {
    if (d.held) return d
    return { ...d, value: 1 + Math.floor(rng() * 6) }
  })
}

export function valuesOf(dice: YotsyDie[]): number[] {
  return dice.map((d) => d.value)
}

export function counts(values: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0]
  for (const v of values) c[v] = (c[v] ?? 0) + 1
  return c
}

export function sumValues(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function isYahtzee(values: number[]): boolean {
  return values.length === 5 && values.every((v) => v === values[0])
}

/** Kismet pip colors: 1+6 black, 2+5 red, 3+4 green. */
export function dieColor(value: number): YotsyDieColor {
  if (value === 1 || value === 6) return 'black'
  if (value === 2 || value === 5) return 'red'
  return 'green'
}

export function colorsOf(values: number[]): YotsyDieColor[] {
  return values.map(dieColor)
}

export function isFlush(values: number[]): boolean {
  if (values.length !== 5) return false
  const col = dieColor(values[0]!)
  return values.every((v) => dieColor(v) === col)
}

/** Sorted unique faces present. */
export function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

export function hasStraight(values: number[], length: number): boolean {
  const u = uniqueSorted(values)
  if (u.length < length) return false
  for (let start = 0; start <= u.length - length; start++) {
    let ok = true
    for (let i = 1; i < length; i++) {
      if (u[start + i]! !== u[start]! + i) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

/** Two pairs whose faces share a color (or 4oak / FH-color / kismet). */
export function hasTwoPairSameColor(values: number[]): boolean {
  if (isYahtzee(values)) return true
  const c = counts(values)
  const pairFaces: number[] = []
  for (let f = 1; f <= 6; f++) {
    if ((c[f] ?? 0) >= 4) return true // four of a kind
    if ((c[f] ?? 0) >= 2) pairFaces.push(f)
  }
  if (pairFaces.length < 2) return false
  // Need two pairs of the same color
  for (let i = 0; i < pairFaces.length; i++) {
    for (let j = i + 1; j < pairFaces.length; j++) {
      if (dieColor(pairFaces[i]!) === dieColor(pairFaces[j]!)) return true
    }
  }
  return false
}

/** Full house: 3+2, or five-of-a-kind (Kismet counts as FH). */
export function hasFullHouse(values: number[]): boolean {
  if (isYahtzee(values)) return true
  const c = counts(values)
  const has3 = c.some((n, i) => i > 0 && n === 3)
  const has2 = c.some((n, i) => i > 0 && n === 2)
  return has3 && has2
}
