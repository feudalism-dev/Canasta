import { describe, expect, it } from 'vitest'
import { createRummyMatch, withPhysicalSeats } from '../core/rummy/state'
import { rummySoloPhysicalSeats } from '../ui/rummyLocalSession'
import { rummyNamesPipe, rummyScoresPipe } from './rummyDisplaySync'

describe('rummy display pipes', () => {
  it('maps solo human seat 2 onto Furware slot 2 with bot name on another chair', () => {
    const seats = rummySoloPhysicalSeats(2, 2)
    expect(seats).toEqual([2, 0])
    let state = createRummyMatch(['Bandor', 'Brass'], [false, true], 'standard', 1)
    state = withPhysicalSeats(state, seats)
    state.players[0]!.score = 12
    state.players[1]!.score = 31
    expect(rummyNamesPipe(state)).toEqual(['Brass', '', 'Bandor', ''])
    expect(rummyScoresPipe(state)).toEqual([31, 0, 12, 0])
  })
})
