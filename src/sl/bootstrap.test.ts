import { describe, expect, it } from 'vitest'
import { isTableHudSession, readSlBootstrap } from './bootstrap'

const HUD =
  'https://feudalism-dev.github.io/Canasta/?tableId=11111111-1111-1111-1111-111111111111&seat=0&uid=22222222-2222-2222-2222-222222222222&rev=34&client=hud&sl_cap=https%3A%2F%2Fexample.com%2Fcap'

describe('HUD bootstrap', () => {
  it('treats a table HUD URL as a seated session even without a name', () => {
    const boot = readSlBootstrap(HUD)
    expect(boot).not.toBeNull()
    expect(boot?.client).toBe('hud')
    expect(isTableHudSession(boot)).toBe(true)
  })

  it('does not treat Play in Browser or the table top as the HUD', () => {
    expect(isTableHudSession(readSlBootstrap('https://x.test/Canasta/?client=web'))).toBe(false)
    expect(
      isTableHudSession(
        readSlBootstrap(
          'https://x.test/Canasta/?tableId=11111111-1111-1111-1111-111111111111&uid=22222222-2222-2222-2222-222222222222&client=web',
        ),
      ),
    ).toBe(false)
    expect(isTableHudSession(readSlBootstrap('https://x.test/Canasta/?view=table'))).toBe(false)
    expect(isTableHudSession(readSlBootstrap('https://x.test/Canasta/?view=scores'))).toBe(false)
  })
})
