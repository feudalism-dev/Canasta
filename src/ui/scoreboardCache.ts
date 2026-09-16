import { mergeGames, normalizeGames, type ScoreGames } from '../sl/scoresApi'

const KEY = 'canasta.scoreboard.cache.v1'

export type ScoreboardCache = {
  savedAt: number
  local: ScoreGames
  net: ScoreGames
  month: string
}

export function loadScoreboardCache(): ScoreboardCache | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ScoreboardCache>
    if (!parsed || typeof parsed.savedAt !== 'number') return null
    return {
      savedAt: parsed.savedAt,
      local: normalizeGames(parsed.local),
      net: normalizeGames(parsed.net),
      month: typeof parsed.month === 'string' ? parsed.month : '',
    }
  } catch {
    return null
  }
}

export function saveScoreboardCache(local: ScoreGames, net: ScoreGames, month: string): void {
  try {
    const payload: ScoreboardCache = {
      savedAt: Date.now(),
      local,
      net,
      month,
    }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* private mode / CEF quota */
  }
}

/** Merge one successful poll into the persisted parlor snapshot. */
export function writeScoreboardCachePatch(
  prevLocal: ScoreGames,
  prevNet: ScoreGames,
  prevMonth: string,
  patchLocal?: unknown,
  patchNet?: unknown,
  month?: string,
): ScoreboardCache {
  const local = patchLocal != null ? mergeGames(prevLocal, patchLocal) : prevLocal
  const net = patchNet != null ? mergeGames(prevNet, patchNet) : prevNet
  const nextMonth = month || prevMonth
  saveScoreboardCache(local, net, nextMonth)
  return { savedAt: Date.now(), local, net, month: nextMonth }
}

export function cacheAgeLabel(savedAt: number, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - savedAt) / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}
