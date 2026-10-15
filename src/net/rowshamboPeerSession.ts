import Peer, { type DataConnection } from 'peerjs'
import { fillRowShamBoBots } from '../ai/rowshamboBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyRowShamBoMove } from '../core/rowshambo/rules'
import { createRowShamBoMatch, withPhysicalSeats } from '../core/rowshambo/state'
import type { RowShamBoMove, RowShamBoState, RowShamBoVariant } from '../core/rowshambo/types'
import {
  clampMatchTarget,
  clampRowShamBoPlayerCount,
  normalizeRowShamBoVariant,
} from '../core/rowshambo/variants'
import type { Occupant } from '../core/tableSeating'
import { MATCH_RESUME_GRACE_MS } from './matchResume'

export type RowShamBoLobbySeat = {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  avatarUid?: string
  seat?: number
}

type Wire =
  | { t: 'hello'; id: string; name: string; avatarUid?: string; seat?: number }
  | {
      t: 'lobby'
      seats: RowShamBoLobbySeat[]
      roomCode: string
      variant: RowShamBoVariant
      playerCount: number
      playTo: number
    }
  | { t: 'ready'; id: string; ready: boolean }
  | { t: 'start'; state: RowShamBoState }
  | { t: 'state'; state: RowShamBoState }
  | { t: 'move'; move: RowShamBoMove }
  | { t: 'info'; message: string }
  | { t: 'variant'; variant: RowShamBoVariant }
  | { t: 'playerCount'; playerCount: number }
  | { t: 'playTo'; playTo: number }

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
export function rowshamboMpRoster(
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

export type RowShamBoPeerSession = {
  roomCode: string
  isHost: boolean
  localId: string
  seats: RowShamBoLobbySeat[]
  state: RowShamBoState | null
  localIndex: number
  status: string
  variant: RowShamBoVariant
  playerCount: number
  playTo: number
  aiThinking: boolean
  onChange: (cb: () => void) => () => void
  setReady: (ready: boolean) => void
  setVariant: (v: RowShamBoVariant) => void
  setPlayerCount: (n: number) => void
  setPlayTo: (n: number) => void
  startMatch: (occupants?: Occupant[]) => void
  submit: (move: RowShamBoMove) => { ok: true } | { ok: false; error: string }
  destroy: () => void
}

export type RowShamBoHostOpts = {
  roomCode?: string
  avatarUid?: string
  seat?: number
  variant?: RowShamBoVariant
  playerCount?: number
  playTo?: number
  allowedAvatarUids?: string[]
}

export async function createRowShamBoPeerHost(
  playerName: string,
  opts?: RowShamBoHostOpts,
): Promise<RowShamBoPeerSession> {
  const code = (opts?.roomCode || roomCode()).toUpperCase()
  const peer = new Peer(`rowshambo-${code}-host`)
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
  return buildRowShamBoSession(peer, code, true, playerName, undefined, opts)
}

export async function joinRowShamBoPeerRoom(
  code: string,
  playerName: string,
  opts?: { avatarUid?: string; seat?: number },
): Promise<RowShamBoPeerSession> {
  const peer = new Peer()
  try {
    await waitOpen(peer)
    const conn = peer.connect(`rowshambo-${code.toUpperCase()}-host`, { reliable: true })
    await waitConn(conn)
    return buildRowShamBoSession(peer, code.toUpperCase(), false, playerName, conn, opts)
  } catch (e) {
    try {
      peer.destroy()
    } catch {
      /* ignore */
    }
    throw e
  }
}

function pumpRowShamBoBots(state: RowShamBoState): RowShamBoState {
  let cur = state
  for (let i = 0; i < 32; i++) {
    const next = fillRowShamBoBots(cur)
    if (next === cur) break
    cur = next
  }
  return cur
}

function buildRowShamBoSession(
  peer: Peer,
  code: string,
  isHost: boolean,
  playerName: string,
  hostConn: DataConnection | undefined,
  opts?: RowShamBoHostOpts & { avatarUid?: string; seat?: number },
): RowShamBoPeerSession {
  const localId = peer.id
  const localAvatarUid = opts?.avatarUid
  let localSeat = opts?.seat
  let seats: RowShamBoLobbySeat[] = isHost
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
  let state: RowShamBoState | null = null
  let status = isHost ? `Room ${code}` : 'Joining…'
  let variant: RowShamBoVariant = normalizeRowShamBoVariant(opts?.variant || 'classic')
  let playerCount = clampRowShamBoPlayerCount(opts?.playerCount ?? 2)
  let playTo = clampMatchTarget(opts?.playTo ?? 100)
  let aiThinking = false
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
    broadcast({ t: 'lobby', seats, roomCode: code, variant, playerCount, playTo })
    notify()
  }

  const localIndexOf = (): number => {
    if (!state) return 0
    if (localSeat != null && localSeat >= 0) {
      const bySeat = state.players.findIndex((p) => p.seat === localSeat)
      if (bySeat >= 0) return bySeat
    }
    const seatName = seats.find((s) => s.id === localId)?.name
    const idx = state.players.findIndex((p) => p.name === seatName)
    return idx >= 0 ? idx : 0
  }

  const applyHostMove = (move: RowShamBoMove): { ok: true } | { ok: false; error: string } => {
    if (!state) return { ok: false, error: 'No match' }
    if (move.t === 'pass' || move.t === 'play') {
      const li = localIndexOf()
      const pl = state.players[li]
      if (!pl?.hand.some((c) => c.id === move.cardId)) {
        return { ok: false, error: 'Not your card' }
      }
    }
    const res = applyRowShamBoMove(state, move)
    if (!res.ok) return res
    state = pumpRowShamBoBots(res.state)
    broadcast({ t: 'state', state })
    notify()
    return { ok: true }
  }

  const onMessage = (fromId: string, msg: Wire) => {
    if (msg.t === 'hello' && isHost) {
      if (allowed) {
        const uid = (msg.avatarUid || '').toLowerCase()
        if (!uid || !allowed.has(uid)) {
          const c = conns.get(fromId)
          if (c) send(c, { t: 'info', message: 'Not seated at this Row! Sham! Bo! table.' })
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
      variant = normalizeRowShamBoVariant(msg.variant)
      playerCount = msg.playerCount
      playTo = clampMatchTarget(msg.playTo)
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
      variant = normalizeRowShamBoVariant(msg.variant)
      playerCount = clampRowShamBoPlayerCount(playerCount)
      syncLobby()
      return
    }
    if (msg.t === 'playerCount' && isHost) {
      playerCount = clampRowShamBoPlayerCount(msg.playerCount)
      syncLobby()
      return
    }
    if (msg.t === 'playTo' && isHost) {
      playTo = clampMatchTarget(msg.playTo)
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
      if (msg.move.t === 'pass' || msg.move.t === 'play') {
        const cardId = msg.move.cardId
        const fromSeat = seats.find((s) => s.id === fromId)
        const seatIdx =
          fromSeat?.seat != null && fromSeat.seat >= 0
            ? state.players.findIndex((p) => p.seat === fromSeat.seat)
            : -1
        const pl = seatIdx >= 0 ? state.players[seatIdx] : undefined
        if (!pl?.hand.some((c) => c.id === cardId)) {
          const c = conns.get(fromId)
          if (c) send(c, { t: 'info', message: 'Not your card' })
          return
        }
      }
      const res = applyRowShamBoMove(state, msg.move)
      if (!res.ok) {
        const c = conns.get(fromId)
        if (c) send(c, { t: 'info', message: res.error })
        return
      }
      state = pumpRowShamBoBots(res.state)
      broadcast({ t: 'state', state })
      notify()
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
    get playTo() {
      return playTo
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
      variant = normalizeRowShamBoVariant(v)
      playerCount = clampRowShamBoPlayerCount(playerCount)
      syncLobby()
    },
    setPlayerCount: (n) => {
      if (!isHost) return
      playerCount = clampRowShamBoPlayerCount(n)
      syncLobby()
    },
    setPlayTo: (n) => {
      if (!isHost) return
      playTo = clampMatchTarget(n)
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
      const roster = rowshamboMpRoster(merged, playerCount)
      state = withPhysicalSeats(
        createRowShamBoMatch(roster.names, roster.computers, variant, playTo),
        roster.seats,
      )
      state = pumpRowShamBoBots(state)
      broadcast({ t: 'start', state })
      status = 'Match started'
      notify()
    },
    submit: (move) => {
      if (!state) return { ok: false, error: 'No match' }
      if (isHost) {
        return applyHostMove(move)
      }
      const c = [...conns.values()][0]
      if (!c) return { ok: false, error: 'Not connected' }
      send(c, { t: 'move', move })
      return { ok: true }
    },
    destroy: () => {
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
