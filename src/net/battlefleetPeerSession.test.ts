import { describe, expect, it } from 'vitest'
import { battlefleetMpRoster } from './battlefleetPeerSession'

describe('battlefleetMpRoster', () => {
  it('fills empty seats with bots for FFA', () => {
    const r = battlefleetMpRoster(
      [{ seat: 0, name: 'Alice', uid: 'a', joined: true }],
      3,
      'ffa',
    )
    expect(r.names).toHaveLength(3)
    expect(r.computers).toEqual([false, true, true])
    expect(r.seats[0]).toBe(0)
  })

  it('forces four seats in teams mode', () => {
    const r = battlefleetMpRoster(
      [
        { seat: 0, name: 'A', uid: 'a', joined: true },
        { seat: 1, name: 'B', uid: 'b', joined: true },
      ],
      2,
      'teams',
    )
    expect(r.names).toHaveLength(4)
    expect(r.computers.filter(Boolean)).toHaveLength(2)
  })
})
