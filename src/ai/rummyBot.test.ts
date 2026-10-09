import { describe, expect, it } from 'vitest'
import { pickRummyBotMove } from './rummyBot'
import { createRummyMatch } from '../core/rummy/state'
import { applyRummyMove } from '../core/rummy/rules'

describe('rummy bot', () => {
  it('draws on an open turn', () => {
    const state = createRummyMatch(['You', 'Bot'], [false, true], 'standard', 7)
    // Force bot's turn
    state.current = 1
    state.phase = 'draw'
    state.drew = false
    const move = pickRummyBotMove(state)
    expect(move?.t === 'drawStock' || move?.t === 'takeDiscard').toBe(true)
  })

  it('discards after drawing', () => {
    let state = createRummyMatch(['You', 'Bot'], [false, true], 'standard', 11)
    state.current = 1
    state.phase = 'draw'
    state.drew = false
    const draw = applyRummyMove(state, { t: 'drawStock' })
    expect(draw.ok).toBe(true)
    if (!draw.ok) return
    state = draw.state
    const move = pickRummyBotMove(state)
    expect(move?.t).toBe('discard')
  })
})
