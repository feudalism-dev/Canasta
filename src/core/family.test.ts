import { describe, expect, it } from 'vitest'
import { familyHintPresent, normalizeFamily, resolveTableFamily } from './family'

describe('family lock', () => {
  it('defaults unknown to canasta', () => {
    expect(normalizeFamily(undefined)).toBe('canasta')
    expect(normalizeFamily('')).toBe('canasta')
  })

  it('prefers rummy from any hint', () => {
    expect(resolveTableFamily(undefined, 'rummy')).toBe('rummy')
    expect(resolveTableFamily('rummy', 'canasta')).toBe('rummy')
    expect(resolveTableFamily('', '')).toBe('canasta')
  })

  it('recognizes trick family', () => {
    expect(normalizeFamily('trick')).toBe('trick')
    expect(resolveTableFamily('trick')).toBe('trick')
    expect(familyHintPresent('trick')).toBe(true)
  })

  it('recognizes ichi family', () => {
    expect(normalizeFamily('ichi')).toBe('ichi')
    expect(resolveTableFamily('ichi')).toBe('ichi')
    expect(familyHintPresent('ichi')).toBe(true)
    expect(normalizeFamily('ICHI')).toBe('ichi')
  })

  it('detects whether a real family hint exists', () => {
    expect(familyHintPresent(undefined, '')).toBe(false)
    expect(familyHintPresent('rummy')).toBe(true)
    expect(familyHintPresent('', 'canasta')).toBe(true)
  })
})
