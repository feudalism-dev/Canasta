import Peer, { type DataConnection } from 'peerjs'
import { createMatch } from '../core/state'
import { tryApply, type GameMove, type MatchState } from '../core/rules'
import { DEFAULT_HOUSE, type HouseRules, type Variant } from '../core/types'

export type LobbySeat = {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  avatarUid?: string
  seat?: number
}

type Wire =
  | { t: 'hello'; id: string; name: string; avatarUid?: string; seat?: number }
  | { t: 'lobby'; seats: LobbySeat[]; roomCode: string; variant: Variant }
  | { t: 'ready'; id: string; ready: boolean }
  | { t: 'start'; state: MatchState }
  | { t: 'state'; state: MatchState }
  | { t: 'move'; move: GameMove; playerIndex?: number }
  | { t: 'info'; message: string }
  | { t: 'variant'; variant: Variant }

function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export type PeerHostOptions = {
  roomCode?: string
  allowedAvatarUids?: string[]
  avatarUid?: string
  seat?: number
  variant?: Variant
  house?: HouseRules
}

export type PeerJoinOptions = {
  avatarUid?: string
  seat?: number
}

export type PeerSession = {
  roomCode: string
  isHost: boolean
  localId: string
  seats: LobbySeat[]
  state: MatchState | null
  localIndex: number
  status: string
  variant: Variant
  onChange: (cb: () => void) => () => void
  setReady: (ready: boolean) => void
  setVariant: (v: Variant) => void
  setHouse: (house: HouseRules) => void
  startMatch: () => void
  submit: (move: GameMove) => void
  destroy: () => void
}

export async function createPeerHost(playerName: string, opts?: PeerHostOptions): Promise<PeerSession> {
  const code = (opts?.roomCode || roomCode()).toUpperCase()
  const peer = new Peer(`canasta-${code}-host`)
  await waitOpen(peer)
  return buildSession(peer, code, true, playerName, undefined, opts)
}

export async function joinPeerRoom(
  code: string,
  playerName: string,
  opts?: PeerJoinOptions,
): Promise<PeerSession> {
  const peer = new Peer()
  await waitOpen(peer)
  const conn = peer.connect(`canasta-${code.toUpperCase()}-host`, { reliable: true })
  await waitConn(conn)
  return buildSession(peer, code.toUpperCase(), false, playerName, conn, opts)
}

function waitOpen(peer: Peer): Promise<void> {
  return new Promise((resolve, reject) => {
    peer.on('open', () => resolve())
    peer.on('error', (e) => reject(e))
  })
}

function waitConn(conn: DataConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.on('open', () => resolve())
    conn.on('error', (e) => reject(e))
  })
}

function buildSession(
  peer: Peer,
  code: string,
  isHost: boolean,
  playerName: string,
  existingConn?: DataConnection,
  opts?: PeerHostOptions | PeerJoinOptions,
): PeerSession {
  const localId = peer.id
  const localAvatarUid = opts && 'avatarUid' in opts ? opts.avatarUid : undefined
  const localSeat = opts && 'seat' in opts ? opts.seat : undefined
  const allowedAvatarUids =
    opts && 'allowedAvatarUids' in opts && opts.allowedAvatarUids
      ? new Set(opts.allowedAvatarUids.map((u) => u.toLowerCase()))
      : null
  let variant: Variant = opts && 'variant' in opts && opts.variant ? opts.variant : 'canasta'
  let house: HouseRules = opts && 'house' in opts && opts.house ? { ...DEFAULT_HOUSE, ...opts.house } : { ...DEFAULT_HOUSE }
  let seats: LobbySeat[] = [
    {
      id: localId,
      name: playerName || 'Host',
      ready: isHost,
      isHost: true,
      avatarUid: localAvatarUid,
      seat: localSeat,
    },
  ]
  let state: MatchState | null = null
  let status = isHost ? `Room ${code} — share this code` : `Joined ${code}`
  const listeners = new Set<() => void>()
  const conns = new Map<string, DataConnection>()
  const notify = () => listeners.forEach((l) => l())
  const send = (conn: DataConnection, msg: Wire) => conn.send(msg)
  const broadcast = (msg: Wire) => {
    conns.forEach((c) => send(c, msg))
  }

  const syncLobby = () => {
    if (!isHost) return
    broadcast({ t: 'lobby', seats, roomCode: code, variant })
    notify()
  }

  const localIndexOf = (): number => {
    if (!state) return Math.max(0, seats.findIndex((s) => s.id === localId))
    if (localSeat != null && localSeat >= 0) {
      const bySeat = state.players.findIndex((p) => p.seat === localSeat)
      if (bySeat >= 0) return bySeat
    }
    const name = seats.find((s) => s.id === localId)?.name
    const idx = state.players.findIndex((p) => p.displayName === name)
    return idx >= 0 ? idx : 0
  }

  const onMessage = (fromId: string, msg: Wire) => {
    if (msg.t === 'hello' && isHost) {
      if (allowedAvatarUids) {
        const uid = (msg.avatarUid || '').toLowerCase()
        if (!uid || !allowedAvatarUids.has(uid)) {
          const c = conns.get(fromId)
          if (c) send(c, { t: 'info', message: 'Not seated/joined at this Canasta table.' })
          c?.close()
          return
        }
      }
      if (seats.length >= 4) {
        const c = conns.get(fromId)
        if (c) send(c, { t: 'info', message: 'Room full (max 4 players).' })
        return
      }
      if (!seats.some((s) => s.id === msg.id)) {
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
      }
      syncLobby()
      return
    }
    if (msg.t === 'lobby') {
      seats = msg.seats
      variant = msg.variant
      status = `Room ${msg.roomCode}`
      notify()
      return
    }
    if (msg.t === 'variant') {
      variant = msg.variant
      notify()
      return
    }
    if (msg.t === 'ready' && isHost) {
      seats = seats.map((s) => (s.id === msg.id ? { ...s, ready: msg.ready } : s))
      syncLobby()
      return
    }
    if (msg.t === 'start' || msg.t === 'state') {
      state = msg.state
      status = state.lastMessage
      notify()
      return
    }
    if (msg.t === 'move' && isHost && state) {
      const idx = msg.playerIndex ?? state.currentPlayer
      const res = tryApply(state, msg.move, idx)
      if (!res.ok) {
        status = res.error
        notify()
        return
      }
      broadcast({ t: 'state', state })
      status = state.lastMessage
      notify()
      return
    }
    if (msg.t === 'info') {
      status = msg.message
      notify()
    }
  }

  const attach = (conn: DataConnection) => {
    conns.set(conn.peer, conn)
    conn.on('data', (data) => onMessage(conn.peer, data as Wire))
    conn.on('close', () => {
      conns.delete(conn.peer)
      if (isHost) {
        seats = seats.filter((s) => s.id !== conn.peer)
        syncLobby()
      }
    })
    if (!isHost) {
      send(conn, {
        t: 'hello',
        id: localId,
        name: playerName || 'Player',
        avatarUid: localAvatarUid,
        seat: localSeat,
      })
    }
  }

  if (existingConn) attach(existingConn)
  if (isHost) {
    peer.on('connection', (conn) => {
      conn.on('open', () => attach(conn))
    })
  }

  const session: PeerSession = {
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
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    setReady(ready) {
      if (isHost) {
        seats = seats.map((s) => (s.id === localId ? { ...s, ready } : s))
        syncLobby()
      } else {
        const hostConn = [...conns.values()][0]
        if (hostConn) send(hostConn, { t: 'ready', id: localId, ready })
      }
    },
    setVariant(v) {
      if (!isHost) return
      variant = v
      broadcast({ t: 'variant', variant })
      syncLobby()
    },
    setHouse(next) {
      if (!isHost) return
      house = { ...DEFAULT_HOUSE, ...next }
    },
    startMatch() {
      if (!isHost) {
        status = 'Only host can start.'
        notify()
        return
      }
      if (seats.length !== 2 && seats.length !== 4) {
        status = 'Need 2 or 4 players.'
        notify()
        return
      }
      const ordered =
        seats.every((s) => s.seat != null && s.seat >= 0)
          ? [...seats].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
          : seats
      const names = ordered.map((s) => s.name)
      const humans = ordered.map(() => true)
      state = createMatch({ variant, names, humans, house })
      if (ordered.length === 4) {
        ordered.forEach((s, i) => {
          if (state && s.seat != null) state.players[i]!.seat = s.seat
        })
      }
      broadcast({ t: 'start', state })
      status = state.lastMessage
      notify()
    },
    submit(move) {
      if (isHost && state) {
        const res = tryApply(state, move, localIndexOf())
        if (!res.ok) {
          status = res.error
          notify()
          return
        }
        broadcast({ t: 'state', state })
        status = state.lastMessage
        notify()
      } else {
        const hostConn = [...conns.values()][0]
        if (hostConn) send(hostConn, { t: 'move', move, playerIndex: localIndexOf() })
      }
    },
    destroy() {
      peer.destroy()
    },
  }
  return session
}
