import type { SlBootstrap } from './bootstrap'

type SessionOpts = {
  client?: 'hud' | 'browser'
  parked?: boolean
  room?: string
  action?: 'browser' | 'hud' | ''
  token?: string
  /** Override MoAP/boot family (hub tables often update family after attach). */
  family?: string
}

function originPath(): URL {
  const url = new URL(window.location.href)
  url.hash = ''
  return url
}

/** Web `?play=` value that boots the matching family engine (canasta = omit). */
export function playParamForFamily(family: string): string {
  const f = family.trim().toLowerCase()
  if (f === 'rummy') return 'rummy'
  if (f === 'trick') return 'trick'
  if (f === 'ichi') return 'ichi'
  if (f === 'skippo') return 'skippo'
  if (f === 'phaseit') return 'phaseit'
  if (f === 'yotsy') return 'yotsy'
  return ''
}

function resolveFamily(boot: Pick<SlBootstrap, 'family'> | null | undefined, override?: string): string {
  return (override || boot?.family || '').trim().toLowerCase()
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
  const family = resolveFamily(boot, opts.family)
  if (family) params.set('family', family)
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
export function buildMatchBrowserUrl(
  boot: SlBootstrap,
  room: string,
  token: string,
  family?: string,
): string {
  return buildSessionUrl(boot, { client: 'browser', room, token, family })
}

export function buildParkedHudUrl(boot: SlBootstrap, room?: string, family?: string): string {
  return buildSessionUrl(boot, { parked: true, room: room || boot.room, family })
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

/** Standalone web solo — must include family + play so non-Canasta games boot correctly. */
export function standalonePlayUrl(
  boot?: Pick<SlBootstrap, 'name' | 'rev' | 'family'> | null,
  family?: string,
): string {
  const url = originPath()
  const params = new URLSearchParams()
  params.set('client', 'web')
  if (boot?.name) params.set('name', boot.name)
  if (boot?.rev) params.set('rev', boot.rev)
  const fam = resolveFamily(boot, family)
  if (fam) params.set('family', fam)
  const play = playParamForFamily(fam)
  if (play) params.set('play', play)
  url.search = params.toString()
  return url.toString()
}

/** Solo-only path — opens the current family in an external browser. */
export async function openSeatedBrowser(
  boot: SlBootstrap,
  room?: string,
  family?: string,
): Promise<'opened' | 'signaled'> {
  const playUrl = standalonePlayUrl(boot, family)
  await copyText(playUrl)
  const popup = window.open(playUrl, '_blank', 'noopener')
  if (popup) return 'opened'
  window.location.assign(buildSessionUrl(boot, { action: 'browser', client: 'browser', room, family }))
  return 'signaled'
}

/** Guest MP: open minted match URL and park this HUD. */
export async function openMatchInBrowser(
  boot: SlBootstrap,
  room: string,
  token: string,
  family?: string,
): Promise<'opened' | 'signaled'> {
  const playUrl = buildMatchBrowserUrl(boot, room, token, family)
  await copyText(playUrl)
  const popup = window.open(playUrl, '_blank', 'noopener')
  window.location.assign(buildParkedHudUrl(boot, room, family))
  if (popup) return 'opened'
  return 'signaled'
}
