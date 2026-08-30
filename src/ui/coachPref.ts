/** Solo coach tips: persist across deals. Default off. */

export const COACH_TIPS_KEY = 'cn_coach_tips'

export function readCoachTips(): boolean {
  try {
    const v = localStorage.getItem(COACH_TIPS_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* private mode / CEF */
  }
  return false
}

export function writeCoachTips(on: boolean): void {
  try {
    localStorage.setItem(COACH_TIPS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
