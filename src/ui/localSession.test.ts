import { describe, expect, it } from 'vitest'
import { soloHumanIndex, soloRoster, soloSeatCount } from './localSession'

describe('solo seat roster', () => {
  it('puts the human on AVsitter seat 2 as player 3', () => {
    const r = soloRoster('Ada', true, 2)
    expect(r.localIndex).toBe(2)
    expect(r.names).toHaveLength(4)
    expect(r.names[2]).toBe('Ada')
    expect(r.humans).toEqual([false, false, true, false])
  })

  it('uses seat 1 as player 2 in a two-hand game', () => {
    expect(soloSeatCount(false, 1)).toBe(2)
    const r = soloRoster('Ada', false, 1)
    expect(r.localIndex).toBe(1)
    expect(r.names).toEqual(['Brass', 'Ada'])
    expect(r.humans).toEqual([false, true])
  })

  it('deals four hands when seated at chair 3 without partnership', () => {
    expect(soloSeatCount(false, 3)).toBe(4)
    expect(soloHumanIndex(3, 4)).toBe(3)
    const r = soloRoster('Ada', false, 3)
    expect(r.localIndex).toBe(3)
    expect(r.humans[3]).toBe(true)
    expect(r.humans.filter(Boolean)).toHaveLength(1)
  })
})
