import type { RowShamBoKind, RowShamBoVariant } from './types'

/** True if `a` beats `b`. False if tie or `b` beats `a`. */
export function beats(a: RowShamBoKind, b: RowShamBoKind, variant: RowShamBoVariant = 'classic'): boolean {
  if (a === b) return false
  if (a === 'dynamite') return true
  if (b === 'dynamite') return false

  // Classic triad
  if (a === 'rock' && b === 'scissors') return true
  if (a === 'scissors' && b === 'paper') return true
  if (a === 'paper' && b === 'rock') return true

  if (variant === 'elements' || variant === 'triples') {
    // Elements triad among themselves: Water→Earth→Fire→Water
    if (a === 'water' && b === 'earth') return true
    if (a === 'earth' && b === 'fire') return true
    if (a === 'fire' && b === 'water') return true

    // Elements vs basics
    if (a === 'water' && (b === 'rock' || b === 'paper')) return true
    if (a === 'earth' && (b === 'rock' || b === 'scissors')) return true
    if (a === 'fire' && (b === 'paper' || b === 'scissors')) return true

    // Basics that beat elements (inverse of above)
    if (b === 'water' && (a === 'rock' || a === 'paper')) return false
    if (b === 'earth' && (a === 'rock' || a === 'scissors')) return false
    if (b === 'fire' && (a === 'paper' || a === 'scissors')) return false
    if (a === 'scissors' && b === 'water') return true
    if (a === 'paper' && b === 'earth') return true
    if (a === 'rock' && b === 'fire') return true
  }

  return false
}

export function compareOutcome(
  a: RowShamBoKind,
  b: RowShamBoKind,
  variant: RowShamBoVariant = 'classic',
): 'a' | 'b' | 'tie' {
  if (a === b) return 'tie'
  if (beats(a, b, variant)) return 'a'
  if (beats(b, a, variant)) return 'b'
  return 'tie'
}

export function kindLabel(k: RowShamBoKind): string {
  if (k === 'rock') return 'Rock'
  if (k === 'paper') return 'Paper'
  if (k === 'scissors') return 'Scissors'
  if (k === 'dynamite') return 'Dynamite'
  if (k === 'water') return 'Water'
  if (k === 'earth') return 'Earth'
  return 'Fire'
}
