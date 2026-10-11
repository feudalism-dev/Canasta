import { mulberry32 } from '../rng'
import type { YotsyDie } from './types'

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
