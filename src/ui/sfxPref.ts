/** Soft mute for HUD sound effects (localStorage). */

const SFX_KEY = 'canasta.sfx'

export function readSfxEnabled(): boolean {
  try {
    const v = localStorage.getItem(SFX_KEY)
    if (v === null) return true
    return v !== '0'
  } catch {
    return true
  }
}

export function writeSfxEnabled(on: boolean): void {
  try {
    localStorage.setItem(SFX_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
