import Peer, { type DataConnection } from 'peerjs'
import { pumpYotsyBots } from '../ai/yotsyBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyYotsyMove } from '../core/yotsy/rules'
import { createYotsyMatch, withPhysicalSeats } from '../core/yotsy/state'
import type { YotsyMove, YotsyState, YotsyVariant } from '../core/yotsy/types'
import { clampYotsyPlayerCount, normalizeYotsyVariant } from '../core/yotsy/variants'
import type { Occupant } from '../core/tableSeating'
import { MATCH_RESUME_GRACE_MS } from './matchResume'

export type YotsyLobbySeat = {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  avatarUid?: string
  seat?: number
}

type Wire =
  | { t: 'hello'; id: string; name: string; avatarUid?: string; seat?: number }
  | { t: 'lobby'; seats: YotsyLobbySeat[]; roomCode: string; variant: YotsyVariant; playerCount: number }
  | { t: 'ready'; id: string; ready: boolean }
  | { t: 'start'; state: YotsyState }
  | { t: 'state'; state: YotsyState }
  | { t: 'move'; move: YotsyMove }
  | { t: 'info'; message: string }
  | { t: 'variant'; variant: YotsyVariant }
  | { t: 'playerCount'; playerCount: number }

function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

function waitOpen(peer: Peer): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('Peer open timed out')), 12000)
    peer.on('open', () => {
      window.clearTimeout(t)
      resolve()
    })
    peer.on('error', (err) => {
      window.clearTimeout(t)
      reject(err)
    })
  })
}

function waitConn(conn: DataConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('Connect timed out')), 12000)
    conn.on('open', () => {
      window.clearTimeout(t)
      resolve()
    })
    conn.on('error', (err) => {
      window.clearTimeout(t)
      reject(err)
    })
  })
}

/** Build 2–4 player roster from table occupants (empty seats → bots). Free-for-all. */
export function yotsyMpRoster(
  occupants: Occupant[],
  playerCount: number,
): { names: string[]; computers: boolean[]; seats: number[] } {
  const n = Math.max(2, Math.min(4, playerCount))
  const bySeat: (Occupant | undefined)[] = [undefined, undefined, undefined, undefined]
  for (const o of occupants) {
    if (o.seat >= 0 && o.seat < 4 && o.joined !== false) bySeat[o.seat] = o
  }
  const seats: number[] = []
  for (let s = 0; s < 4 && seats.length < n; s++) {
    const o = bySeat[s]
    if (o && (o.uid || o.name)) seats.push(s)
  }
  for (let s = 0; s < 4 && seats.length < n; s++) {
    if (!seats.includes(s)) seats.push(s)
  }
  const names: string[] = []
  const computers: boolean[] = []
  let ai = 0
  for (const s of seats) {
    const o = bySeat[s]
    if (o && (o.uid || o.name)) {
      names.push(o.name || `Player ${s + 1}`)
      computers.push(false)
    } else {
      names.push(COMPUTER_NAMES[ai] ?? `Computer ${s + 1}`)
      computers.push(true)
      ai += 1
    }
  }
  return { names, computers, seats }
}

export type YotsyPeerSession = {
  roomCode: string
  isHost: boolean
  localId: string
  seats: YotsyLobbySeat[]
  state: YotsyState | null
  localIndex: number
  status: string
  variant: YotsyVariant
  playerCount: number
  aiThinking: boolean
  onChange: (cb: () => void) => () => void
  setReady: (ready: boolean) => void
  setVariant: (v: YotsyVariant) => void
  setPlayerCount: (n: number) => void
  startMatch: (occupants?: Occupant[]) => void
  submit: (move: YotsyMove) => { ok: true } | { ok: false; error: string }
  destroy: () => void
}

export type YotsyHostOpts = {
  roomCode?: string
  avatarUid?: string
  seat?: number
  variant?: YotsyVariant
  playerCount?: number
  allowedAvatarUids?: string[]
}

export async function createYotsyPeerHost(
  playerName: string,
  opts?: YotsyHostOpts,
): Promise<YotsyPeerSession> {
  const code = (opts?.roomCode || roomCode()).toUpperCase()
  const peer = new Peer(`yotsy-${code}-host`)
  try {
    await waitOpen(peer)
  } catch (e) {
    try {
      peer.destroy()
    } catch {
      /* ignore */
    }
    throw e
  }
  return buildYotsySession(peer, code, true, playerName, undefined, opts)
}

export async function joinYotsyPeerRoom(
  code: string,
  playerName: string,
  opts?: { avatarUid?: string; seat?: number },
): Promise<YotsyPeerSession> {
  const peer = new Peer()
  try {
    await waitOpen(peer)
    const conn = peer.connect(`yotsy-${code.toUpperCase()}-host`, { reliable: true })
    await waitConn(conn)
    return buildYotsySession(peer, code.toUpperCase(), false, playerName, conn, opts)
  } catch (e) {
    try {
      peer.destroy()
    } catch {
      /* ignore */
    }
    throw e
  }
}

function buildYotsySession(
  peer: Peer,
  code: string,
  isHost: boolean,
  playerName: string,
  hostConn: DataConnection | undefined,
  opts?: YotsyHostOpts & { avatarUid?: string; seat?: number },
): YotsyPeerSession {
  const localId = peer.id
  const localAvatarUid = opts?.avatarUid
  let localSeat = opts?.seat
  let seats: YotsyLobbySeat[] = isHost
    ? [
        {
          id: localId,
          name: playerName,
          ready: false,
          isHost: true,
          avatarUid: localAvatarUid,
          seat: localSeat,
        },
      ]
    : []
  let state: YotsyState | null = null
  let status = isHost ? `Room ${code}` : 'Joining…'
  let variant: YotsyVariant = normalizeYotsyVariant(opts?.variant || 'classic')
  let playerCount = clampYotsyPlayerCount(opts?.playerCount || 4)
  let aiThinking = false
  let cancelled = false
  let running = false
  const listeners = new Set<() => void>()
  const conns = new Map<string, DataConnection>()
  const allowed = opts?.allowedAvatarUids
    ? new Set(opts.allowedAvatarUids.map((u) => u.toLowerCase()))
    : null
  const notify = () => listeners.forEach((l) => l())
  const send = (conn: DataConnection, msg: Wire) => conn.send(msg)
  const broadcast = (msg: Wire) => conns.forEach((c) => send(c, msg))

  const syncLobby = () => {
    if (!isHost) return
    broadcast({ t: 'lobby', seats, roomCode: code, variant, playerCount })
    notify()
  }

  const localIndexOf = (): number => {
    if (!state) return 0
    if (localSeat != null && localSeat >= 0) {
      const bySeat = state.players.findIndex((p) => p.seat === localSeat)
      if (bySeat >= 0) return bySeat
    }
    const name = seats.find((s) => s.id === localId)?.name
    const idx = state.players.findIndex((p) => p.name === name)
    return idx >= 0 ? idx : 0
  }

  const pumpAi = async () => {
    if (!isHost || !state || running || cancelled) return
    running = true
    try {
      state = await pumpYotsyBots(state!, {
        isCancelled: () => cancelled || !state,
        onThinking: (on) => {
          aiThinking = on
          notify()
        },
        onStep: (next) => {
          state = next
          broadcast({ t: 'state', state: next })
          notify()
        },
        getState: () => state!,
      })
    } finally {
      running = false
      aiThinking = false
      notify()
    }
  }

  const onMessage = (fromId: string, msg: Wire) => {
    if (msg.t === 'hello' && isHost) {
      if (allowed) {
        const uid = (msg.avatarUid || '').toLowerCase()
        if (!uid || !allowed.has(uid)) {
          const c = conns.get(fromId)
          if (c) send(c, { t: 'info', message: 'Not seated at this Yotsy table.' })
          c?.close()
          return
        }
      }
      if (!seats.some((s) => s.id === msg.id)) {
        if (seats.length >= 4) {
          const c = conns.get(fromId)
          if (c) send(c, { t: 'info', message: 'Room full (max 4).' })
          return
        }
        seats = [
          ...seats,
          {
            id: msg.id,
            name: msg.name,
            ready: false,
            isHost: false,
            avatarUid: msg.avatarUid,
            seat: msg.seat,
          },
        ]
      } else {
        seats = seats.map((s) =>
          s.id === msg.id
            ? { ...s, name: msg.name, avatarUid: msg.avatarUid, seat: msg.seat ?? s.seat }
            : s,
        )
      }
      syncLobby()
      if (state) {
        const c = conns.get(fromId)
        if (c) send(c, { t: 'start', state })
      }
      return
    }
    if (msg.t === 'lobby') {
      seats = msg.seats
      variant = normalizeYotsyVariant(msg.variant)
      playerCount = msg.playerCount
      status = `Room ${msg.roomCode}`
      notify()
      return
    }
    if (msg.t === 'ready' && isHost) {
      seats = seats.map((s) => (s.id === msg.id ? { ...s, ready: msg.ready } : s))
      syncLobby()
      return
    }
    if (msg.t === 'variant' && isHost) {
      variant = normalizeYotsyVariant(msg.variant)
      playerCount = clampYotsyPlayerCount(playerCount)
      syncLobby()
      return
    }
    if (msg.t === 'playerCount' && isHost) {
      playerCount = clampYotsyPlayerCount(msg.playerCount)
      syncLobby()
      return
    }
    if (msg.t === 'start') {
      state = msg.state
      status = 'Match started'
      notify()
      return
    }
    if (msg.t === 'state') {
      state = msg.state
      notify()
      return
    }
    if (msg.t === 'move' && isHost) {
      if (!state) return
      const res = applyYotsyMove(state, msg.move)
      if (!res.ok) {
        const c = conns.get(fromId)
        if (c) send(c, { t: 'info', message: res.error })
        return
      }
      state = res.state
      broadcast({ t: 'state', state })
      notify()
      void pumpAi()
      return
    }
    if (msg.t === 'info') {
      status = msg.message
      notify()
    }
  }

  const wireConn = (conn: DataConnection) => {
    const id = conn.peer
    conns.set(id, conn)
    conn.on('data', (raw) => onMessage(id, raw as Wire))
    conn.on('close', () => {
      conns.delete(id)
      if (isHost) {
        seats = seats.filter((s) => s.id !== id)
        syncLobby()
      }
    })
  }

  if (isHost) {
    peer.on('connection', (conn) => {
      wireConn(conn)
    })
  } else if (hostConn) {
    wireConn(hostConn)
    send(hostConn, {
      t: 'hello',
      id: localId,
      name: playerName,
      avatarUid: localAvatarUid,
      seat: localSeat,
    })
  }

  void MATCH_RESUME_GRACE_MS

  return {
    roomCode: code,
    isHost,
    localId,
    get seats() {
      return seats
    },
    get state() {
      return state
    },
    get localIndex() {
      return localIndexOf()
    },
    get status() {
      return status
    },
    get variant() {
      return variant
    },
    get playerCount() {
      return playerCount
    },
    get aiThinking() {
      return aiThinking
    },
    onChange: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    setReady: (ready) => {
      if (isHost) {
        seats = seats.map((s) => (s.id === localId ? { ...s, ready } : s))
        syncLobby()
      } else {
        const c = [...conns.values()][0]
        if (c) send(c, { t: 'ready', id: localId, ready })
      }
    },
    setVariant: (v) => {
      if (!isHost) return
      variant = normalizeYotsyVariant(v)
      playerCount = clampYotsyPlayerCount(playerCount)
      syncLobby()
    },
    setPlayerCount: (n) => {
      if (!isHost) return
      playerCount = clampYotsyPlayerCount(n)
      syncLobby()
    },
    startMatch: (occupants = []) => {
      if (!isHost || state) return
      const merged: Occupant[] = occupants.map((o) => ({ ...o }))
      for (const s of seats) {
        if (s.seat == null || s.seat < 0) continue
        const hit = merged.find((o) => o.seat === s.seat)
        if (hit) {
          hit.name = s.name
          hit.uid = s.avatarUid || hit.uid
          hit.joined = true
        } else {
          merged.push({ seat: s.seat, name: s.name, uid: s.avatarUid, joined: true })
        }
      }
      const roster = yotsyMpRoster(merged, playerCount)
      state = withPhysicalSeats(
        createYotsyMatch(roster.names, roster.computers, variant),
        roster.seats,
      )
      broadcast({ t: 'start', state })
      status = 'Match started'
      notify()
      void pumpAi()
    },
    submit: (move) => {
      if (!state) return { ok: false, error: 'No match' }
      const li = localIndexOf()
      if (state.current !== li) return { ok: false, error: 'Not your turn' }
      if (isHost) {
        const res = applyYotsyMove(state, move)
        if (!res.ok) return res
        state = res.state
        broadcast({ t: 'state', state })
        notify()
        void pumpAi()
        return { ok: true }
      }
      const c = [...conns.values()][0]
      if (!c) return { ok: false, error: 'Not connected' }
      send(c, { t: 'move', move })
      return { ok: true }
    },
    destroy: () => {
      cancelled = true
      conns.forEach((c) => c.close())
      conns.clear()
      try {
        peer.destroy()
      } catch {
        /* ignore */
      }
      listeners.clear()
    },
  }
}
