import { describe, expect, it } from 'vitest'
import { buildResolveSteps } from './resolve'
import type { RowShamBoCard } from './types'

function c(kind: RowShamBoCard['kind'], id: string): RowShamBoCard {
  return { id, kind }
}

describe('rowshambo resolve chain', () => {
  it('matches ROCK/ROCK/SCISSORS/PAPER example', () => {
    // P1 button ROCK, CW: P2 ROCK, P3 SCISSORS, P4 PAPER
    const plays = [c('rock', 'a'), c('rock', 'b'), c('scissors', 'c'), c('paper', 'd')]
    const { deltas, steps } = buildResolveSteps(plays, 0, 'cw', 'classic')
    expect(deltas).toEqual([1, 1, 0, 2])
    expect(steps).toHaveLength(3)
    expect(steps[0]!.outcome).toBe('tie')
    expect(steps[1]!.outcome).toBe('contestedWin')
    expect(steps[2]!.outcome).toBe('nextWin')
  })

  it('2p simple win', () => {
    const plays = [c('rock', 'a'), c('scissors', 'b')]
    const { deltas } = buildResolveSteps(plays, 0, 'cw', 'classic')
    expect(deltas).toEqual([1, 0])
  })
})
