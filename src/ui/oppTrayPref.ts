/** HUD book panels: persist Show/Hide. Defaults: both shown. Table top is unchanged. */

export const OPP_BOOKS_KEY = 'cn_opp_tray'
export const OUR_BOOKS_KEY = 'cn_our_books'

function readFlag(key: string, defaultOn = true): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* private mode / CEF */
  }
  return defaultOn
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Their books on this HUD. Default shown. */
export function readOppBooks(): boolean {
  return readFlag(OPP_BOOKS_KEY, true)
}

export function writeOppBooks(on: boolean): void {
  writeFlag(OPP_BOOKS_KEY, on)
}

/** Our books on this HUD. Default shown. */
export function readOurBooks(): boolean {
  return readFlag(OUR_BOOKS_KEY, true)
}

export function writeOurBooks(on: boolean): void {
  writeFlag(OUR_BOOKS_KEY, on)
}

/** @deprecated use readOppBooks */
export const readOppTray = readOppBooks
/** @deprecated use writeOppBooks */
export const writeOppTray = writeOppBooks
