import Peer, { type DataConnection } from 'peerjs'
import { pumpComputers } from '../ai/computerTurns'
import type { AiDifficulty } from '../ai/heuristic'
import { createMatch } from '../core/state'
import { fourHandRoster, type Occupant } from '../core/tableSeating'
import { tryApply, type GameMove, type MatchState } from '../core/rules'
import { DEFAULT_HOUSE, normalizeHouse } from '../core/houseRules'
import type { HouseRules, Variant } from '../core/types'

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
  | { t: 'lobby'; seats: LobbySeat[]; roomCode: string; variant: Variant; house: HouseRules }
  | { t: 'ready'; id: string; ready: boolean }
  | { t: 'start'; state: MatchState; occupants: { uid: string; seat: number }[] }
  | { t: 'state'; state: MatchState }
  | { t: 'move'; move: GameMove; playerIndex?: number }
  | { t: 'info'; message: string }
  | { t: 'variant'; variant: Variant }
  | { t: 'house'; house: HouseRules }

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
  difficulty?: AiDifficulty
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
  house: HouseRules
  aiThinking: boolean
  onChange: (cb: () => void) => () => void
  setReady: (ready: boolean) => void
  setVariant: (v: Variant) => void
  setHouse: (house: HouseRules) => void
  startMatch: (occupants?: Occupant[]) => void
  submit: (move: GameMove) => void
  destroy: () => void
}

export async function createPeerHost(playerName: string, opts?: PeerHostOptions): Promise<PeerSession> {
  const code = (opts?.roomCode || roomCode()).toUpperCase()
  const peer = new Peer(`canasta-${code}-host`)
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
  return buildSession(peer, code, true, playerName, undefined, opts)
}

export async function joinPeerRoom(
  code: string,
  playerName: string,
  opts?: PeerJoinOptions,
): Promise<PeerSession> {
  const peer = new Peer()
  try {
    await waitOpen(peer)
    const conn = peer.connect(`canasta-${code.toUpperCase()}-host`, { reliable: true })
    await waitConn(conn)
    return buildSession(peer, code.toUpperCase(), false, playerName, conn, opts)
  } catch (e) {
    try {
      peer.destroy()
    } catch {
      /* ignore */
    }
    throw e
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    p.then(
      (v) => {
        window.clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function waitOpen(peer: Peer, ms = 12000): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      peer.on('open', () => resolve())
      peer.on('error', (e) => reject(e))
    }),
    ms,
    'Peer broker',
  )
}

function waitConn(conn: DataConnection, ms = 12000): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      conn.on('open', () => resolve())
      conn.on('error', (e) => reject(e))
    }),
    ms,
    'Peer host link',
  )
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
  let localSeat = opts && 'seat' in opts ? opts.seat : undefined
  const difficulty: AiDifficulty =
    opts && 'difficulty' in opts && opts.difficulty ? opts.difficulty : 'normal'
  const allowedAvatarUids =
    opts && 'allowedAvatarUids' in opts && opts.allowedAvatarUids
      ? new Set(opts.allowedAvatarUids.map((u) => u.toLowerCase()))
      : null
  let variant: Variant = opts && 'variant' in opts && opts.variant ? opts.variant : 'canasta'
  let house: HouseRules = opts && 'house' in opts && opts.house ? normalizeHouse(opts.house) : { ...DEFAULT_HOUSE }
  let seats: LobbySeat[] = [
    {
      id: localId,
      name: playerName || (isHost ? 'Host' : 'Player'),
      ready: isHost,
      isHost,
      avatarUid: localAvatarUid,
      seat: localSeat,
    },
  ]
  let state: MatchState | null = null
  let status = isHost ? `Room ${code} — share this code` : `Joined ${code}`
  let aiThinking = false
  let cancelled = false
  let running = false
  const listeners = new Set<() => void>()
  const conns = new Map<string, DataConnection>()
  const notify = () => listeners.forEach((l) => l())
  const send = (conn: DataConnection, msg: Wire) => conn.send(msg)
  const broadcast = (msg: Wire) => {
    conns.forEach((c) => send(c, msg))
  }

  const syncLobby = () => {
    if (!isHost) return
    broadcast({ t: 'lobby', seats, roomCode: code, variant, house })
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

  const applyOccupantSeats = (rows: { uid: string; seat: number }[]) => {
    const uid = (localAvatarUid || '').toLowerCase()
    if (!uid) return
    const mine = rows.find((r) => (r.uid || '').toLowerCase() === uid)
    if (mine && mine.seat >= 0) localSeat = mine.seat
  }

  const pumpAi = async () => {
    if (!isHost || !state || running || cancelled) return
    running = true
    try {
      await pumpComputers(state, difficulty, {
        isCancelled: () => cancelled || !state,
        onThinking: (on) => {
          aiThinking = on
          notify()
        },
        onStep: () => {
          if (!state) return
          broadcast({ t: 'state', state })
          status = state.lastMessage
          notify()
        },
      })
    } finally {
      aiThinking = false
      running = false
      notify()
    }
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
      } else {
        seats = seats.map((s) =>
          s.id === msg.id
            ? { ...s, name: msg.name, avatarUid: msg.avatarUid, seat: msg.seat ?? s.seat }
            : s,
        )
      }
      syncLobby()
      // Late joiner / reconnect after Start: push current match so their UI leaves the lobby.
      if (state) {
        const c = conns.get(fromId)
        if (c) {
          send(c, {
            t: 'start',
            state,
            occupants: seats
              .filter((s) => s.seat != null && s.seat >= 0)
              .map((s) => ({ uid: s.avatarUid || '', seat: s.seat as number })),
          })
        }
      }
      return
    }
    if (msg.t === 'lobby') {
      seats = msg.seats
      variant = msg.variant
      if (msg.house) house = normalizeHouse(msg.house)
      status = `Room ${msg.roomCode}`
      notify()
      return
    }
    if (msg.t === 'variant') {
      variant = msg.variant
      notify()
      return
    }
    if (msg.t === 'house') {
      house = normalizeHouse(msg.house)
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
      if (msg.t === 'start') applyOccupantSeats(msg.occupants)
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
      void pumpAi()
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
    get house() {
      return house
    },
    get aiThinking() {
      return aiThinking
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    setReady(ready) {
      seats = seats.map((s) => (s.id === localId ? { ...s, ready } : s))
      if (isHost) {
        syncLobby()
      } else {
        notify()
        const hostConn = [...conns.values()][0]
        if (hostConn) send(hostConn, { t: 'ready', id: localId, ready })
      }
    },
    setVariant(v) {
      if (!isHost) return
      if (v !== variant) {
        variant = v
        seats = seats.map((s) => ({ ...s, ready: false }))
      }
      broadcast({ t: 'variant', variant })
      syncLobby()
    },
    setHouse(next) {
      if (!isHost) return
      const normalized = normalizeHouse(next)
      const changed = JSON.stringify(normalized) !== JSON.stringify(house)
      house = normalized
      if (changed) seats = seats.map((s) => ({ ...s, ready: false }))
      broadcast({ t: 'house', house })
      syncLobby()
    },
    startMatch(tableOccupants?: Occupant[]) {
      if (!isHost) {
        status = 'Only host can start.'
        notify()
        return
      }
      if (seats.length > 0 && seats.some((s) => !s.ready)) {
        status = 'Everyone must Ready (accept the current house rules) before Start.'
        notify()
        return
      }
      const fromTable = (tableOccupants || []).filter((o) => o.seat >= 0 && o.seat < 4)
      const fromLobby = seats
        .filter((s) => s.seat != null && s.seat >= 0)
        .map((s) => ({ seat: s.seat as number, name: s.name, uid: s.avatarUid }))
      const humans = fromTable.length ? fromTable : fromLobby
      if (humans.length < 1) {
        status = 'Need at least one seated player.'
        notify()
        return
      }
      const roster = fourHandRoster(humans)
      state = createMatch({ variant, names: roster.names, humans: roster.humans, house })
      const occupantRows = humans.map((h) => ({ uid: h.uid || '', seat: h.seat }))
      applyOccupantSeats(occupantRows)
      broadcast({ t: 'start', state, occupants: occupantRows })
      status = state.lastMessage
      notify()
      // Flaky guests sometimes miss the first big payload — push state again shortly.
      window.setTimeout(() => {
        if (!cancelled && state) broadcast({ t: 'state', state })
      }, 1500)
      void pumpAi()
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
        void pumpAi()
      } else {
        const hostConn = [...conns.values()][0]
        if (hostConn) send(hostConn, { t: 'move', move, playerIndex: localIndexOf() })
      }
    },
    destroy() {
      cancelled = true
      peer.destroy()
    },
  }
  return session
}
