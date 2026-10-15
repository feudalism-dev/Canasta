import { describe, expect, it } from 'vitest'
import { applyRowShamBoMove } from './rules'
import { createRowShamBoMatch } from './state'

describe('rowshambo rules', () => {
  it('deals 5 and runs pass→play after ackDir', () => {
    let state = createRowShamBoMatch(['You', 'Bot'], [false, true], 'classic', 100, 42)
    expect(state.players[0]!.hand).toHaveLength(5)
    expect(state.players[1]!.hand).toHaveLength(5)
    expect(state.stock.length).toBe(52 - 10)
    expect(state.direction).toBeTruthy()
    expect(state.phase).toBe('chooseDir')

    const ack = applyRowShamBoMove(state, { t: 'ackDir' })
    expect(ack.ok).toBe(true)
    if (!ack.ok) return
    state = ack.state
    expect(state.phase).toBe('pass')

    const card = state.players[0]!.hand[0]!
    const pass = applyRowShamBoMove(state, { t: 'pass', cardId: card.id })
    expect(pass.ok).toBe(true)
    if (!pass.ok) return
    expect(pass.state.phase).toBe('play')
    expect(pass.state.players.every((p) => p.hand.length === 5)).toBe(true)
  })
})
