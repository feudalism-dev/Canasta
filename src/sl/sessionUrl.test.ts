import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playParamForFamily, standalonePlayUrl } from './sessionUrl'

describe('sessionUrl family for browser solo', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { href: 'https://example.test/Canasta/?client=hud&family=canasta' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps families to play= boot params', () => {
    expect(playParamForFamily('yotsy')).toBe('yotsy')
    expect(playParamForFamily('rummy')).toBe('rummy')
    expect(playParamForFamily('trick')).toBe('trick')
    expect(playParamForFamily('canasta')).toBe('')
  })

  it('standalone solo URL includes family and play for Yotsy', () => {
    const href = standalonePlayUrl({ name: 'Ada', rev: '125', family: '' }, 'yotsy')
    const u = new URL(href)
    expect(u.searchParams.get('client')).toBe('web')
    expect(u.searchParams.get('family')).toBe('yotsy')
    expect(u.searchParams.get('play')).toBe('yotsy')
  })

  it('standalone canasta omits play=', () => {
    const href = standalonePlayUrl({ name: 'Ada', rev: '125', family: 'canasta' }, 'canasta')
    const u = new URL(href)
    expect(u.searchParams.get('family')).toBe('canasta')
    expect(u.searchParams.get('play')).toBeNull()
  })
})
