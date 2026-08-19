/** Parse Second Life MOAP bootstrap params from search or hash. */

export type SlBootstrap = {
  tableId: string
  uid: string
  seat: number
  slCap: string
  name: string
  rev: string
  parked: boolean
  client: 'hud' | 'browser' | ''
  room: string
  action: string
  view: 'table' | ''
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
  const view = viewRaw === 'table' ? 'table' : ''
  if (view !== 'table' && (!tableId || !uid)) return null
  const seatRaw = merged.get('seat')
  const seat = seatRaw != null && seatRaw !== '' ? Number(seatRaw) : -1
  const clientRaw = (merged.get('client') || '').trim().toLowerCase()
  const client = clientRaw === 'browser' || clientRaw === 'hud' ? clientRaw : ''
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
  }
}
