/** Parse Second Life MOAP bootstrap params from search or hash. */

export type SlBootstrap = {
  tableId: string
  uid: string
  seat: number
  slCap: string
  name: string
  rev: string
  parked: boolean
  client: 'hud' | 'browser' | 'web' | ''
  room: string
  action: string
  view: 'table' | 'scores' | ''
  token: string
}

function paramsFrom(raw: string): URLSearchParams {
  const q = raw.startsWith('?') || raw.startsWith('#') ? raw.slice(1) : raw
  const cut = q.indexOf('?')
  return new URLSearchParams(cut >= 0 ? q.slice(cut + 1) : q)
}

export function readSlBootstrap(href = window.location.href): SlBootstrap | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const merged = new URLSearchParams()
  paramsFrom(url.search).forEach((v, k) => merged.set(k, v))
  paramsFrom(url.hash).forEach((v, k) => merged.set(k, v))
  const tableId = (merged.get('tableId') || merged.get('table') || '').trim()
  const uid = (merged.get('uid') || '').trim()
  const viewRaw = (merged.get('view') || '').trim().toLowerCase()
  const view = viewRaw === 'table' ? 'table' : viewRaw === 'scores' ? 'scores' : ''
  if (view !== 'table' && view !== 'scores' && (!tableId || !uid)) return null
  const seatRaw = merged.get('seat')
  const seat = seatRaw != null && seatRaw !== '' ? Number(seatRaw) : -1
  const clientRaw = (merged.get('client') || '').trim().toLowerCase()
  const client = clientRaw === 'browser' || clientRaw === 'hud' || clientRaw === 'web' ? clientRaw : ''
  const parked = merged.get('parked') === '1' || merged.get('parked') === 'true' || clientRaw === 'parked'
  return {
    tableId,
    uid: uid || 'spec',
    seat: Number.isFinite(seat) ? seat : -1,
    slCap: (merged.get('sl_cap') || merged.get('slCap') || '').trim(),
    name: (merged.get('name') || '').trim(),
    rev: (merged.get('rev') || '').trim(),
    parked,
    client,
    room: (merged.get('room') || '').trim().toUpperCase(),
    action: (merged.get('action') || '').trim().toLowerCase(),
    view,
    token: (merged.get('token') || '').trim(),
  }
}

export function isTableHudSession(boot: SlBootstrap | null): boolean {
  if (!boot) return false
  if (boot.view === 'table' || boot.view === 'scores') return false
  if (boot.parked) return false
  if (boot.client === 'browser' || boot.client === 'web') return false
  return Boolean(boot.tableId && boot.uid)
}

/** Seated guest playing MP from an external browser via minted token. */
export function isSeatedBrowserSession(boot: SlBootstrap | null): boolean {
  if (!boot) return false
  if (boot.parked) return false
  if (boot.view === 'table' || boot.view === 'scores') return false
  if (boot.client !== 'browser') return false
  return Boolean(boot.tableId && boot.uid && boot.slCap && boot.token && boot.room)
}

export function readWebNameHint(href = window.location.href): string {
  try {
    const url = new URL(href)
    const merged = new URLSearchParams()
    paramsFrom(url.search).forEach((v, k) => merged.set(k, v))
    paramsFrom(url.hash).forEach((v, k) => merged.set(k, v))
    return (merged.get('name') || '').trim()
  } catch {
    return ''
  }
}
