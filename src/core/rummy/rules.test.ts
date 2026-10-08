import { describe, expect, it } from 'vitest'
import { applyRummyMove } from './rules'
import { createRummyMatch } from './state'

describe('rummy rules', () => {
  it('deals seven cards and allows stock draw then discard', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'standard', 42)
    expect(state.players[0]!.hand).toHaveLength(7)
    expect(state.players[1]!.hand).toHaveLength(7)
    expect(state.phase).toBe('draw')
    const drew = applyRummyMove(state, { t: 'drawStock' })
    expect(drew.ok).toBe(true)
    if (!drew.ok) return
    expect(drew.state.drew).toBe(true)
    expect(drew.state.players[0]!.hand).toHaveLength(8)
    const cardId = drew.state.players[0]!.hand[0]!.id
    const disc = applyRummyMove(drew.state, { t: 'discard', cardId })
    expect(disc.ok).toBe(true)
    if (!disc.ok) return
    expect(disc.state.current).toBe(1)
    expect(disc.state.phase).toBe('draw')
  })
})
