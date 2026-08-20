import type { SlBootstrap } from './bootstrap'

type SessionOpts = {
  client?: 'hud' | 'browser'
  parked?: boolean
  room?: string
  action?: 'browser' | 'hud' | ''
  token?: string
}

function originPath(): URL {
  const url = new URL(window.location.href)
  url.hash = ''
  return url
}

export function buildSessionUrl(boot: SlBootstrap, opts: SessionOpts = {}): string {
  const url = originPath()
  const params = new URLSearchParams()
  params.set('tableId', boot.tableId)
  params.set('uid', boot.uid)
  params.set('seat', String(boot.seat))
  if (boot.slCap) params.set('sl_cap', boot.slCap)
  if (boot.name) params.set('name', boot.name)
  if (boot.rev) params.set('rev', boot.rev)
  const room = (opts.room || boot.room || '').trim()
  if (room) params.set('room', room)
  const token = (opts.token || boot.token || '').trim()
  if (token) params.set('token', token)
  if (opts.parked) params.set('parked', '1')
  else params.set('client', opts.client || 'browser')
  if (opts.action) params.set('action', opts.action)
  url.search = params.toString()
  return url.toString()
}

/** Minted match URL for a seated guest (external browser). */
export function buildMatchBrowserUrl(boot: SlBootstrap, room: string, token: string): string {
  return buildSessionUrl(boot, { client: 'browser', room, token })
}

export function buildParkedHudUrl(boot: SlBootstrap, room?: string): string {
  return buildSessionUrl(boot, { parked: true, room: room || boot.room })
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', 'true')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function standalonePlayUrl(boot?: Pick<SlBootstrap, 'name' | 'rev'> | null): string {
  const url = originPath()
  const params = new URLSearchParams()
  params.set('client', 'web')
  if (boot?.name) params.set('name', boot.name)
  if (boot?.rev) params.set('rev', boot.rev)
  url.search = params.toString()
  return url.toString()
}

/** Solo-only path (unchanged). */
export async function openSeatedBrowser(boot: SlBootstrap, room?: string): Promise<'opened' | 'signaled'> {
  const playUrl = standalonePlayUrl(boot)
  await copyText(playUrl)
  const popup = window.open(playUrl, '_blank', 'noopener')
  if (popup) return 'opened'
  window.location.assign(buildSessionUrl(boot, { action: 'browser', client: 'browser', room }))
  return 'signaled'
}

/** Guest MP: open minted match URL and park this HUD. */
export async function openMatchInBrowser(
  boot: SlBootstrap,
  room: string,
  token: string,
): Promise<'opened' | 'signaled'> {
  const playUrl = buildMatchBrowserUrl(boot, room, token)
  await copyText(playUrl)
  const popup = window.open(playUrl, '_blank', 'noopener')
  window.location.assign(buildParkedHudUrl(boot, room))
  if (popup) return 'opened'
  return 'signaled'
}
