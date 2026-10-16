import { describe, expect, it } from 'vitest'
import { beats, compareOutcome } from './compare'

describe('rowshambo compare', () => {
  it('classic hierarchy', () => {
    expect(beats('rock', 'scissors')).toBe(true)
    expect(beats('scissors', 'paper')).toBe(true)
    expect(beats('paper', 'rock')).toBe(true)
    expect(compareOutcome('rock', 'rock')).toBe('tie')
  })

  it('dynamite beats all basics', () => {
    expect(beats('dynamite', 'rock')).toBe(true)
    expect(beats('dynamite', 'paper')).toBe(true)
    expect(beats('dynamite', 'scissors')).toBe(true)
    expect(compareOutcome('dynamite', 'dynamite')).toBe('tie')
    expect(beats('rock', 'dynamite')).toBe(false)
  })

  it('elements triad and vs basics', () => {
    expect(beats('water', 'fire', 'elements')).toBe(true)
    expect(beats('fire', 'earth', 'elements')).toBe(true)
    expect(beats('earth', 'water', 'elements')).toBe(true)
    expect(beats('water', 'earth', 'elements')).toBe(false)
    expect(beats('earth', 'fire', 'elements')).toBe(false)
    expect(beats('fire', 'water', 'elements')).toBe(false)
    expect(beats('water', 'rock', 'elements')).toBe(true)
    expect(beats('water', 'paper', 'elements')).toBe(true)
    expect(beats('earth', 'rock', 'elements')).toBe(true)
    expect(beats('earth', 'scissors', 'elements')).toBe(true)
    expect(beats('fire', 'paper', 'elements')).toBe(true)
    expect(beats('fire', 'scissors', 'elements')).toBe(true)
    expect(beats('scissors', 'water', 'elements')).toBe(true)
    expect(beats('paper', 'earth', 'elements')).toBe(true)
    expect(beats('rock', 'fire', 'elements')).toBe(true)
    expect(beats('dynamite', 'water', 'elements')).toBe(true)
    expect(beats('dynamite', 'earth', 'elements')).toBe(true)
    expect(beats('dynamite', 'fire', 'elements')).toBe(true)
    expect(beats('water', 'dynamite', 'elements')).toBe(false)
    expect(compareOutcome('water', 'water', 'elements')).toBe('tie')
  })
})
