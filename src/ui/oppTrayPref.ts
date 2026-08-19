/** HUD opponent tray: persist Show/Hide. Default shown. */

export const OPP_TRAY_KEY = 'cn_opp_tray'

export function readOppTray(): boolean {
  try {
    const v = localStorage.getItem(OPP_TRAY_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* private mode / CEF */
  }
  return true
}

export function writeOppTray(on: boolean): void {
  try {
    localStorage.setItem(OPP_TRAY_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
