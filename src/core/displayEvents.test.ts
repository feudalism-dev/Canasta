import { describe, expect, it } from 'vitest'
import { eventsForMove, startPayload } from './displayEvents'
import { createMatch } from './state'
import type { Variant } from './types'

function matchOverEvents(variant: Variant): string[] {
  const prev = createMatch({ variant, names: ['A', 'B'], humans: [true, true], seed: 1 })
  const next = structuredClone(prev)
  next.phase = 'matchEnd'
  next.winnerTeam = 0
  return eventsForMove(prev, next, { kind: 'continue' }, 0)
}

describe('table display payload', () => {
  it('formats solo and match start pipes', () => {
    expect(startPayload('solo', 4, 0, ['a', 'b', '', ''])).toBe('solo|4|0|a|b||')
    expect(startPayload('match', 4, 0, ['a', 'b', 'c', 'd'])).toBe('match|a|b|c|d')
  })

  it('emits GAME_OVER with a one-letter game code', () => {
    expect(matchOverEvents('canasta').find((e) => e.startsWith('GAME_OVER'))).toMatch(/\|c$/)
    expect(matchOverEvents('handAndFoot').find((e) => e.startsWith('GAME_OVER'))).toMatch(/\|h$/)
    expect(matchOverEvents('samba').find((e) => e.startsWith('GAME_OVER'))).toMatch(/\|s$/)
    expect(matchOverEvents('bolivia').find((e) => e.startsWith('GAME_OVER'))).toMatch(/\|b$/)
  })
})
