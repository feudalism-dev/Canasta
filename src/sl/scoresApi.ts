/** JSONP client for the in-world scoreboard HTTP-IN. */

export type ScoreRow = {
  u: string
  n: string
  s: number
}

export type ScoreBundle = {
  w: ScoreRow[]
  m: ScoreRow[]
  l: ScoreRow[]
}

/** c = classic Canasta, h = Hand & Foot, s = Samba, b = Bolivia */
export type ScoreGame = 'c' | 'h' | 's' | 'b'

export type ScoreGames = {
  c: ScoreBundle
  h: ScoreBundle
  s: ScoreBundle
  b: ScoreBundle
}

export type ScorePayload = {
  ok: boolean
  week?: string
  month?: string
  game?: ScoreGame
  local?: Partial<ScoreGames>
  net?: Partial<ScoreGames>
  error?: string
}

type JsonpParams = Record<string, string | number | boolean | undefined | null>

function validCallbackName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

function nextCallback(): string {
  return `cnsc_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

function ensureTrailingSlash(url: string): string {
  if (!url) return url
  return url.endsWith('/') ? url : `${url}/`
}

function emptyBundle(): ScoreBundle {
  return { w: [], m: [], l: [] }
}

function emptyGames(): ScoreGames {
  return { c: emptyBundle(), h: emptyBundle(), s: emptyBundle(), b: emptyBundle() }
}

function asBundle(raw: unknown): ScoreBundle {
  if (!raw || typeof raw !== 'object') return emptyBundle()
  const o = raw as Partial<ScoreBundle>
  return {
    w: Array.isArray(o.w) ? o.w : [],
    m: Array.isArray(o.m) ? o.m : [],
    l: Array.isArray(o.l) ? o.l : [],
  }
}

/** Full empty boards (initial UI state). */
export function normalizeGames(raw: unknown): ScoreGames {
  if (!raw || typeof raw !== 'object') return emptyGames()
  const o = raw as Record<string, unknown>
  return {
    c: asBundle(o.c),
    h: asBundle(o.h),
    s: asBundle(o.s),
    b: asBundle(o.b),
  }
}

/** Merge a one-game payload into existing boards (LSL returns one game per poll). */
export function mergeGames(base: ScoreGames, patch: unknown): ScoreGames {
  if (!patch || typeof patch !== 'object') return base
  const o = patch as Record<string, unknown>
  const next: ScoreGames = { ...base }
  ;(['c', 'h', 's', 'b'] as const).forEach((g) => {
    if (o[g] != null) next[g] = asBundle(o[g])
  })
  return next
}

export function jsonpScores(apiBase: string, params: JsonpParams = {}, timeoutMs = 8000): Promise<ScorePayload> {
  return new Promise((resolve, reject) => {
    if (!apiBase) {
      reject(new Error('No scoreboard HTTP-IN URL (sl_cap)'))
      return
    }
    const cb = nextCallback()
    if (!validCallbackName(cb)) {
      reject(new Error('bad callback'))
      return
    }
    const script = document.createElement('script')
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('scoreboard request timed out'))
    }, timeoutMs)
    const cleanup = () => {
      window.clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[cb]
      script.remove()
    }
    ;(window as unknown as Record<string, unknown>)[cb] = (data: ScorePayload) => {
      cleanup()
      resolve(data || { ok: false, error: 'empty' })
    }
    const q = new URLSearchParams()
    q.set('cb', cb)
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return
      q.set(k, String(v))
    })
    script.src = `${ensureTrailingSlash(apiBase)}?${q.toString()}`
    script.onerror = () => {
      cleanup()
      reject(new Error('scoreboard JSONP failed'))
    }
    document.head.appendChild(script)
  })
}

export function fetchScores(slCap: string, game: ScoreGame = 'c'): Promise<ScorePayload> {
  return jsonpScores(slCap, { action: 'scores', game }, 10000)
}

export function refreshScores(slCap: string, game: ScoreGame = 'c'): Promise<ScorePayload> {
  return jsonpScores(slCap, { action: 'refresh', game }, 12000)
}
