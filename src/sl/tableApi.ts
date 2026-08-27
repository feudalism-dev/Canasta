/** JSONP client for Canasta table HTTP-IN (MOAP / CEF). */

export type TableRosterEntry = {
  seat: number
  uid: string
  name: string
  active: boolean
  joined: boolean
  browserClaimed?: boolean
}

export type TableStatus = {
  ok: boolean
  tableId?: string
  mode?: 'idle' | 'solo' | 'lobby' | 'match' | 'resetting' | string
  activeCount?: number
  seatedCount?: number
  roomCode?: string
  hostUid?: string
  soloUid?: string
  ownerUid?: string
  /** Compact house-rules pipe string from table LSD. */
  house?: string
  roster?: TableRosterEntry[]
  grace?: { uid: string; seat: number; until: number; secondsLeft?: number; name?: string }[]
  error?: string
  board?: string
  token?: string
  exp?: number
}

type JsonpParams = Record<string, string | number | boolean | undefined | null>

function validCallbackName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

function nextCallback(): string {
  return `cncb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

function ensureTrailingSlash(url: string): string {
  if (!url) return url
  return url.endsWith('/') ? url : `${url}/`
}

export function jsonpTable(apiBase: string, params: JsonpParams, timeoutMs = 8000): Promise<TableStatus> {
  return new Promise((resolve, reject) => {
    if (!apiBase) {
      reject(new Error('No table HTTP-IN URL (sl_cap)'))
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
      reject(new Error('table request timed out'))
    }, timeoutMs)
    const cleanup = () => {
      window.clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[cb]
      script.remove()
    }
    ;(window as unknown as Record<string, unknown>)[cb] = (data: TableStatus) => {
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
      reject(new Error('table JSONP failed'))
    }
    document.head.appendChild(script)
  })
}

export async function tableStatus(slCap: string, uid: string, seat: number): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'status', uid, seat })
}

export async function tableEnter(slCap: string, uid: string, seat: number, name: string): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'enter', uid, seat, name })
}

export async function tableLeave(slCap: string, uid: string, seat: number): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'leave', uid, seat })
}

export async function tableClaimSolo(slCap: string, uid: string, seat: number, players = 4): Promise<TableStatus> {
  const n = Math.max(2, Math.min(4, players))
  return jsonpTable(slCap, { action: 'claim_solo', uid, seat, players: n })
}

export async function tableEndGame(slCap: string, uid: string, seat: number): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'end_game', uid, seat })
}

export async function tableCreate(slCap: string, uid: string, seat: number): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'create', uid, seat })
}

export async function tableJoin(slCap: string, uid: string, seat: number): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'join', uid, seat })
}

export async function tableStart(slCap: string, uid: string, seat: number): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'start', uid, seat })
}

/** Guest only: mint a one-time browser match URL token (after Join). */
export async function tableMintBrowser(slCap: string, uid: string, seat: number): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'mint_browser', uid, seat })
}

/** Redeem minted token from an external browser session. Token goes in `p`. */
export async function tableClaimBrowser(
  slCap: string,
  uid: string,
  seat: number,
  token: string,
): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'claim_browser', uid, seat, p: token })
}

export async function tableSaveHouse(slCap: string, uid: string, seat: number, compact: string): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'save_house', uid, seat, p: compact })
}

export async function tableEvent(
  slCap: string,
  uid: string,
  seat: number,
  pipePayload: string,
): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'event', uid, seat, p: pipePayload })
}

const BOARD_CHUNK = 160

export async function tableGetBoard(slCap: string): Promise<TableStatus> {
  return jsonpTable(slCap, { action: 'board', uid: 'spec' })
}

export async function tableSetBoard(
  slCap: string,
  uid: string,
  seat: number,
  compact: string,
): Promise<TableStatus> {
  const body = compact || ''
  const n = Math.max(1, Math.ceil(body.length / BOARD_CHUNK))
  let last: TableStatus = { ok: true }
  for (let i = 0; i < n; i++) {
    const chunk = body.slice(i * BOARD_CHUNK, (i + 1) * BOARD_CHUNK)
    last = await tableEvent(slCap, uid, seat, `BOARD|${i}|${n}|${chunk}`)
    if (!last.ok) return last
  }
  return last
}

export async function tableSetNames(
  slCap: string,
  uid: string,
  seat: number,
  names: string[],
): Promise<TableStatus> {
  const slots = [0, 1, 2, 3].map((i) => (names[i] || '').replace(/\|/g, ' '))
  return tableEvent(slCap, uid, seat, `NAMES|${slots.join('|')}`)
}
