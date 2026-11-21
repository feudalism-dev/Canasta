import Peer, { type DataConnection } from 'peerjs'
import { fillBattleFleetBots } from '../ai/battlefleetBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { sanitizeBattleFleetForViewer } from '../core/battlefleet/publicBoard'
import { applyBattleFleetMove } from '../core/battlefleet/rules'
import { createBattleFleetMatch, withPhysicalSeats } from '../core/battlefleet/state'
import type {
  BattleFleetDifficulty,
  BattleFleetMode,
  BattleFleetMove,
  BattleFleetState,
} from '../core/battlefleet/types'
import type { Occupant } from '../core/tableSeating'
import { MATCH_RESUME_GRACE_MS } from './matchResume'

export type BattleFleetLobbySeat = {
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
      seats: BattleFleetLobbySeat[]
      roomCode: string
      mode: BattleFleetMode
      playerCount: number
      difficulty: BattleFleetDifficulty
    }
  | { t: 'ready'; id: string; ready: boolean }
  | { t: 'start'; state: BattleFleetState }
  | { t: 'state'; state: BattleFleetState }
  | { t: 'move'; move: BattleFleetMove }
  | { t: 'info'; message: string }
  | { t: 'mode'; mode: BattleFleetMode }
  | { t: 'playerCount'; playerCount: number }
  | { t: 'difficulty'; difficulty: BattleFleetDifficulty }

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

function clampPlayerCount(n: number, mode: BattleFleetMode): number {
  if (mode === 'teams') return 4
  return Math.max(2, Math.min(4, Math.floor(n) || 2))
}

function normalizeMode(m: BattleFleetMode | string | undefined): BattleFleetMode {
  return m === 'teams' ? 'teams' : 'ffa'
}

function normalizeDifficulty(
  d: BattleFleetDifficulty | string | undefined,
): BattleFleetDifficulty {
  if (d === 'easy' || d === 'hard') return d
  return 'normal'
}

/** Build 2–4 player roster from table occupants (empty seats → bots). */
export function battlefleetMpRoster(
  occupants: Occupant[],
  playerCount: number,
  mode: BattleFleetMode,
): { names: string[]; computers: boolean[]; seats: number[] } {
  const n = clampPlayerCount(playerCount, mode)
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

export type BattleFleetPeerSession = {
  roomCode: string
  isHost: boolean
  localId: string
  seats: BattleFleetLobbySeat[]
  state: BattleFleetState | null
  localIndex: number
  status: string
  mode: BattleFleetMode
  playerCount: number
  difficulty: BattleFleetDifficulty
  onChange: (cb: () => void) => () => void
  setReady: (ready: boolean) => void
  setMode: (m: BattleFleetMode) => void
  setPlayerCount: (n: number) => void
  setDifficulty: (d: BattleFleetDifficulty) => void
  startMatch: (occupants?: Occupant[]) => void
  submit: (move: BattleFleetMove) => { ok: true } | { ok: false; error: string }
  destroy: () => void
}

export type BattleFleetHostOpts = {
  roomCode?: string
  avatarUid?: string
  seat?: number
  mode?: BattleFleetMode
  playerCount?: number
  difficulty?: BattleFleetDifficulty
  allowedAvatarUids?: string[]
}

export async function createBattleFleetPeerHost(
  playerName: string,
  opts?: BattleFleetHostOpts,
): Promise<BattleFleetPeerSession> {
  const code = (opts?.roomCode || roomCode()).toUpperCase()
  const peer = new Peer(`battlefleet-${code}-host`)
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
  return buildBattleFleetSession(peer, code, true, playerName, undefined, opts)
}

export async function joinBattleFleetPeerRoom(
  code: string,
  playerName: string,
  opts?: { avatarUid?: string; seat?: number },
): Promise<BattleFleetPeerSession> {
  const peer = new Peer()
  try {
    await waitOpen(peer)
    const conn = peer.connect(`battlefleet-${code.toUpperCase()}-host`, { reliable: true })
    await waitConn(conn)
    return buildBattleFleetSession(peer, code.toUpperCase(), false, playerName, conn, opts)
  } catch (e) {
    try {
      peer.destroy()
    } catch {
      /* ignore */
    }
    throw e
  }
}

function buildBattleFleetSession(
  peer: Peer,
  code: string,
  isHost: boolean,
  playerName: string,
  hostConn: DataConnection | undefined,
  opts?: BattleFleetHostOpts & { avatarUid?: string; seat?: number },
): BattleFleetPeerSession {
  const localId = peer.id
  const localAvatarUid = opts?.avatarUid
  let localSeat = opts?.seat
  let seats: BattleFleetLobbySeat[] = isHost
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
  /** Host keeps authoritative full state; guests hold sanitized views. */
  let authState: BattleFleetState | null = null
  let viewState: BattleFleetState | null = null
  let status = isHost ? `Room ${code}` : 'Joining…'
  let mode: BattleFleetMode = normalizeMode(opts?.mode)
  let playerCount = clampPlayerCount(opts?.playerCount ?? 2, mode)
  let difficulty: BattleFleetDifficulty = normalizeDifficulty(opts?.difficulty)
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
    broadcast({ t: 'lobby', seats, roomCode: code, mode, playerCount, difficulty })
    notify()
  }

  const localIndexOf = (): number => {
    const st = viewState ?? authState
    if (!st) return 0
    if (localSeat != null && localSeat >= 0) {
      const bySeat = st.players.findIndex((p) => p.seat === localSeat)
      if (bySeat >= 0) return bySeat
    }
    const seatName = seats.find((s) => s.id === localId)?.name
    const idx = st.players.findIndex((p) => p.name === seatName)
    return idx >= 0 ? idx : 0
  }

  const localPlayerId = (): string | null => {
    const st = authState ?? viewState
    if (!st) return null
    return st.players[localIndexOf()]?.id ?? null
  }

  const viewerIdForPeer = (peerId: string): string | null => {
    if (!authState) return null
    const lobby = seats.find((s) => s.id === peerId)
    if (lobby?.seat != null && lobby.seat >= 0) {
      const pl = authState.players.find((p) => p.seat === lobby.seat)
      if (pl) return pl.id
    }
    if (lobby?.name) {
      const pl = authState.players.find((p) => p.name === lobby.name)
      if (pl) return pl.id
    }
    return null
  }

  const pushViews = () => {
    if (!isHost || !authState) return
    for (const [peerId, conn] of conns) {
      const vid = viewerIdForPeer(peerId)
      if (!vid) continue
      send(conn, { t: 'state', state: sanitizeBattleFleetForViewer(authState, vid) })
    }
    notify()
  }

  const pushStart = () => {
    if (!isHost || !authState) return
    for (const [peerId, conn] of conns) {
      const vid = viewerIdForPeer(peerId)
      if (!vid) continue
      send(conn, { t: 'start', state: sanitizeBattleFleetForViewer(authState, vid) })
    }
    notify()
  }

  const applyHostMove = (move: BattleFleetMove): { ok: true } | { ok: false; error: string } => {
    if (!authState) return { ok: false, error: 'No match' }
    const res = applyBattleFleetMove(authState, move)
    if (!res.ok) return res
    authState = fillBattleFleetBots(res.state)
    pushViews()
    return { ok: true }
  }

  const onMessage = (fromId: string, msg: Wire) => {
    if (msg.t === 'hello' && isHost) {
      if (allowed) {
        const uid = (msg.avatarUid || '').toLowerCase()
        if (!uid || !allowed.has(uid)) {
          const c = conns.get(fromId)
          if (c) send(c, { t: 'info', message: 'Not seated at this Battle Fleet table.' })
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
      if (authState) {
        const c = conns.get(fromId)
        const vid = viewerIdForPeer(fromId)
        if (c && vid) send(c, { t: 'start', state: sanitizeBattleFleetForViewer(authState, vid) })
      }
      return
    }
    if (msg.t === 'lobby') {
      seats = msg.seats
      mode = normalizeMode(msg.mode)
      playerCount = clampPlayerCount(msg.playerCount, mode)
      difficulty = normalizeDifficulty(msg.difficulty)
      status = `Room ${msg.roomCode}`
      notify()
      return
    }
    if (msg.t === 'ready' && isHost) {
      seats = seats.map((s) => (s.id === msg.id ? { ...s, ready: msg.ready } : s))
      syncLobby()
      return
    }
    if (msg.t === 'mode' && isHost) {
      mode = normalizeMode(msg.mode)
      playerCount = clampPlayerCount(playerCount, mode)
      syncLobby()
      return
    }
    if (msg.t === 'playerCount' && isHost) {
      playerCount = clampPlayerCount(msg.playerCount, mode)
      syncLobby()
      return
    }
    if (msg.t === 'difficulty' && isHost) {
      difficulty = normalizeDifficulty(msg.difficulty)
      syncLobby()
      return
    }
    if (msg.t === 'start') {
      viewState = msg.state
      authState = null
      status = 'Match started'
      notify()
      return
    }
    if (msg.t === 'state') {
      viewState = msg.state
      notify()
      return
    }
    if (msg.t === 'move' && isHost) {
      if (!authState) return
      const vid = viewerIdForPeer(fromId)
      if (!vid || msg.move.playerId !== vid) {
        const c = conns.get(fromId)
        if (c) send(c, { t: 'info', message: 'Not your turn / seat.' })
        return
      }
      const res = applyBattleFleetMove(authState, msg.move)
      if (!res.ok) {
        const c = conns.get(fromId)
        if (c) send(c, { t: 'info', message: res.error })
        return
      }
      authState = fillBattleFleetBots(res.state)
      pushViews()
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
      return isHost ? authState : viewState
    },
    get localIndex() {
      return localIndexOf()
    },
    get status() {
      return status
    },
    get mode() {
      return mode
    },
    get playerCount() {
      return playerCount
    },
    get difficulty() {
      return difficulty
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
    setMode: (m) => {
      if (!isHost) return
      mode = normalizeMode(m)
      playerCount = clampPlayerCount(playerCount, mode)
      syncLobby()
    },
    setPlayerCount: (n) => {
      if (!isHost) return
      playerCount = clampPlayerCount(n, mode)
      syncLobby()
    },
    setDifficulty: (d) => {
      if (!isHost) return
      difficulty = normalizeDifficulty(d)
      syncLobby()
    },
    startMatch: (occupants = []) => {
      if (!isHost || authState) return
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
      const roster = battlefleetMpRoster(merged, playerCount, mode)
      authState = withPhysicalSeats(
        createBattleFleetMatch(roster.names, roster.computers, mode, difficulty),
        roster.seats,
      )
      authState = fillBattleFleetBots(authState)
      status = 'Match started'
      pushStart()
    },
    submit: (move) => {
      if (isHost) {
        if (!authState) return { ok: false, error: 'No match' }
        return applyHostMove(move)
      }
      if (!viewState) return { ok: false, error: 'No match' }
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
