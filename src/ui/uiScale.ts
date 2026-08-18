/** HUD / laptop / 4K: persist a CEF-friendly zoom on the game surface. */

export const UI_SCALE_KEY = 'cn_ui_scale'
export const UI_SCALE_MIN = 0.7
export const UI_SCALE_MAX = 1.45
export const UI_SCALE_STEP = 0.05

export function clampUiScale(n: number): number {
  if (!Number.isFinite(n)) return 1
  const snapped = Math.round(n / UI_SCALE_STEP) * UI_SCALE_STEP
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Number(snapped.toFixed(2))))
}

export function defaultUiScale(): number {
  try {
    const saved = Number(localStorage.getItem(UI_SCALE_KEY))
    if (Number.isFinite(saved) && saved > 0) return clampUiScale(saved)
  } catch {
    /* private mode / CEF */
  }
  const h = typeof window !== 'undefined' ? window.innerHeight : 900
  if (h < 640) return 0.8
  if (h < 800) return 0.9
  return 1
}

export function applyUiScale(scale: number): void {
  const v = clampUiScale(scale)
  document.documentElement.style.setProperty('--ui-scale', String(v))
  try {
    localStorage.setItem(UI_SCALE_KEY, String(v))
  } catch {
    /* ignore */
  }
}
