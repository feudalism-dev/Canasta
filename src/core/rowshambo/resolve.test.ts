import { describe, expect, it } from 'vitest'
import { buildResolveSteps } from './resolve'
import { playerOrderByDirection } from './state'
import type { RowShamBoCard } from './types'

function c(kind: RowShamBoCard['kind'], id: string): RowShamBoCard {
  return { id, kind }
}

describe('rowshambo resolve chain', () => {
  it('walks physical seats clockwise (0→3→2→1), not player-array order', () => {
    // Seats scrambled in the players array (solo when human sits left/right).
    const seats = [1, 0, 2, 3] // indices: You@1, Brass@0, Velvet@2, Lamp@3
    // Velvet (index 2, seat 2) has the button; CW next is seat 1 = You (index 0)
    expect(playerOrderByDirection(
      seats.map((seat) => ({ seat })),
      2,
      'cw',
    )).toEqual([2, 0, 1, 3])

    // Opposite bug: array +1 from Velvet would be Lamp (index 3) first — wrong.
    const plays = [c('scissors', 'you'), c('rock', 'brass'), c('rock', 'velvet'), c('paper', 'lamp')]
    const { steps } = buildResolveSteps(plays, 2, 'cw', 'classic', seats)
    expect(steps[0]!.next).toBe(0) // You, not Lamp (3)
    expect(steps[0]!.contested).toEqual([2])
  })

  it('matches ROCK/ROCK/SCISSORS/PAPER example on physical CW', () => {
    // Button seat 0 ROCK; CW: seat 3 ROCK, seat 2 SCISSORS, seat 1 PAPER
    const plays = [c('rock', 'a'), c('paper', 'd'), c('scissors', 'c'), c('rock', 'b')]
    const { deltas, steps } = buildResolveSteps(plays, 0, 'cw', 'classic')
    expect(deltas).toEqual([1, 2, 0, 1])
    expect(steps).toHaveLength(3)
    expect(steps[0]!.outcome).toBe('tie')
    expect(steps[0]!.next).toBe(3)
    expect(steps[1]!.outcome).toBe('contestedWin')
    expect(steps[1]!.next).toBe(2)
    expect(steps[2]!.outcome).toBe('nextWin')
    expect(steps[2]!.next).toBe(1)
  })

  it('ccw walks the other way (0→1→2→3)', () => {
    const seats = [0, 1, 2, 3]
    expect(playerOrderByDirection(
      seats.map((seat) => ({ seat })),
      0,
      'ccw',
    )).toEqual([0, 1, 2, 3])
    const plays = [c('rock', 'a'), c('scissors', 'b'), c('paper', 'c'), c('rock', 'd')]
    const { steps } = buildResolveSteps(plays, 0, 'ccw', 'classic', seats)
    expect(steps[0]!.next).toBe(1)
  })

  it('2p simple win', () => {
    const plays = [c('rock', 'a'), c('scissors', 'b')]
    const { deltas } = buildResolveSteps(plays, 0, 'cw', 'classic')
    expect(deltas).toEqual([1, 0])
  })
})
