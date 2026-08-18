import { describe, expect, it } from 'vitest'
import { startPayload } from './displayEvents'

describe('table display payload', () => {
  it('formats solo and match start pipes', () => {
    expect(startPayload('solo', 4, 0, ['a', 'b', '', ''])).toBe('solo|4|0|a|b||')
    expect(startPayload('match', 4, 0, ['a', 'b', 'c', 'd'])).toBe('match|a|b|c|d')
  })
})
