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

  it('starts resolve face-down, then flips only the current duel', () => {
    let state = createRowShamBoMatch(['A', 'B', 'C'], [false, true, true], 'classic', 100, 9)
    let res = applyRowShamBoMove(state, { t: 'ackDir' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    res = applyRowShamBoMove(state, { t: 'pass', cardId: state.players[0]!.hand[0]!.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    res = applyRowShamBoMove(state, { t: 'play', cardId: state.players[0]!.hand[0]!.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    expect(state.phase).toBe('resolve')
    expect(state.resolveStepIndex).toBe(-1)
    expect(state.tablePlays.filter(Boolean).length).toBe(3)
    expect(state.revealed.every((r) => !r)).toBe(true)

    res = applyRowShamBoMove(state, { t: 'ackResolve' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    expect(state.resolveStepIndex).toBe(0)
    const revealedCount = state.revealed.filter(Boolean).length
    // First duel flips contested + challenger (2), not everyone yet when 3+ players.
    expect(revealedCount).toBe(2)
  })
})
