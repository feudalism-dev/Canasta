import Peer, { type DataConnection } from 'peerjs'
import {
  WARFRONT_BOT_MS,
  fillWarfrontBots,
  warfrontBotShouldAct,
  warfrontBotStep,
} from '../ai/warfrontBot'
import { COMPUTER_NAMES } from '../core/tableSeating'
import { applyWarfrontMove } from '../core/warfront/rules'
import { createWarfrontMatch, withPhysicalSeats } from '../core/warfront/state'
import type {
  WarfrontAlign,
  WarfrontDifficulty,
  WarfrontMove,
  WarfrontState,
  WarfrontTheater,
} from '../core/warfront/types'
import type { Occupant } from '../core/tableSeating'

export type WarfrontLobbySeat = {
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
      seats: WarfrontLobbySeat[]
      roomCode: string
      theater: WarfrontTheater
      align: WarfrontAlign
      playerCount: number
      difficulty: WarfrontDifficulty
    }
  | { t: 'ready'; id: string; ready: boolean }
  | { t: 'start'; state: WarfrontState }
  | { t: 'state'; state: WarfrontState }
  | { t: 'move'; move: WarfrontMove }
  | { t: 'info'; message: string }
  | { t: 'theater'; theater: WarfrontTheater }
  | { t: 'align'; align: WarfrontAlign }
  | { t: 'playerCount'; playerCount: number }
  | { t: 'difficulty'; difficulty: WarfrontDifficulty }

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

function clampPlayerCount(n: number, align: WarfrontAlign): number {
  if (align === 'teams') return 4
  return Math.max(2, Math.min(4, Math.floor(n) || 2))
}

export function warfrontMpRoster(
  occupants: Occupant[],
  playerCount: number,
  align: WarfrontAlign,
): { names: string[]; computers: boolean[]; seats: number[] } {
  const n = clampPlayerCount(playerCount, align)
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

export type WarfrontPeerSession = {
  roomCode: string
  isHost: boolean
  localId: string
  seats: WarfrontLobbySeat[]
  state: WarfrontState | null
  localIndex: number
  status: string
  theater: WarfrontTheater
  align: WarfrontAlign
  playerCount: number
  difficulty: WarfrontDifficulty
  onChange: (cb: () => void) => () => void
  setReady: (ready: boolean) => void
  setTheater: (t: WarfrontTheater) => void
  setAlign: (a: WarfrontAlign) => void
  setPlayerCount: (n: number) => void
  setDifficulty: (d: WarfrontDifficulty) => void
  startMatch: (occupants?: Occupant[]) => void
  submit: (move: WarfrontMove) => { ok: true } | { ok: false; error: string }
  destroy: () => void
}

export type WarfrontHostOpts = {
  roomCode?: string
  avatarUid?: string
  seat?: number
  theater?: WarfrontTheater
  align?: WarfrontAlign
  playerCount?: number
  difficulty?: WarfrontDifficulty
  allowedAvatarUids?: string[]
}

export async function createWarfrontPeerHost(
  playerName: string,
  opts?: WarfrontHostOpts,
): Promise<WarfrontPeerSession> {
  const code = (opts?.roomCode || roomCode()).toUpperCase()
  const peer = new Peer(`warfront-${code}-host`)
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

export async function joinWarfrontPeerRoom(
  code: string,
  playerName: string,
  opts?: { avatarUid?: string; seat?: number },
): Promise<WarfrontPeerSession> {
  const peer = new Peer()
  try {
    await waitOpen(peer)
    const conn = peer.connect(`warfront-${code.toUpperCase()}-host`, { reliable: true })
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

function buildSession(
  peer: Peer,
  code: string,
  isHost: boolean,
  playerName: string,
  hostConn: DataConnection | undefined,
  opts?: WarfrontHostOpts & { avatarUid?: string; seat?: number },
): WarfrontPeerSession {
  const localId = peer.id
  const localAvatarUid = opts?.avatarUid
  let localSeat = opts?.seat
  let seats: WarfrontLobbySeat[] = isHost
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
  let authState: WarfrontState | null = null
  let viewState: WarfrontState | null = null
  let status = isHost ? `Room ${code}` : 'Joining…'
  let theater: WarfrontTheater = opts?.theater === 'sea' ? 'sea' : 'land'
  let align: WarfrontAlign = opts?.align === 'teams' ? 'teams' : 'ffa'
  let playerCount = clampPlayerCount(opts?.playerCount ?? 2, align)
  let difficulty: WarfrontDifficulty =
    opts?.difficulty === 'easy' || opts?.difficulty === 'hard' ? opts.difficulty : 'normal'
  const listeners = new Set<() => void>()
  const conns = new Map<string, DataConnection>()
  let botTimer: ReturnType<typeof setTimeout> | null = null
  const notify = () => listeners.forEach((l) => l())
  const send = (conn: DataConnection, msg: Wire) => conn.send(msg)
  const broadcast = (msg: Wire) => conns.forEach((c) => send(c, msg))
  const clearBotTimer = () => {
    if (botTimer != null) {
      clearTimeout(botTimer)
      botTimer = null
    }
  }

  const syncLobby = () => {
    if (!isHost) return
    broadcast({ t: 'lobby', seats, roomCode: code, theater, align, playerCount, difficulty })
    notify()
  }

  const localIndexOf = (): number => {
    const st = viewState ?? authState
    if (!st) return 0
    if (localSeat != null && localSeat >= 0) {
      const bySeat = st.players.findIndex((p) => p.seat === localSeat)
      if (bySeat >= 0) return bySeat
    }
    return 0
  }

  const pushState = () => {
    if (!isHost || !authState) return
    broadcast({ t: 'state', state: authState })
    viewState = authState
    notify()
  }

  const scheduleBots = () => {
    if (!isHost) return
    clearBotTimer()
    const step = () => {
      botTimer = null
      if (!authState || !warfrontBotShouldAct(authState)) {
        pushState()
        return
      }
      authState = warfrontBotStep(authState)
      pushState()
      if (warfrontBotShouldAct(authState)) {
        botTimer = setTimeout(step, WARFRONT_BOT_MS)
      }
    }
    if (authState && warfrontBotShouldAct(authState)) {
      botTimer = setTimeout(step, WARFRONT_BOT_MS)
    } else {
      pushState()
    }
  }

  const applyHostMove = (move: WarfrontMove) => {
    if (!authState) return { ok: false as const, error: 'No match' }
    const res = applyWarfrontMove(authState, move)
    if (!res.ok) return res
    authState = res.state
    pushState()
    scheduleBots()
    return { ok: true as const }
  }

  const onMessage = (fromId: string, msg: Wire) => {
    if (msg.t === 'hello' && isHost) {
      if (!seats.some((s) => s.id === msg.id)) {
        if (seats.length >= 4) {
          conns.get(fromId)?.send({ t: 'info', message: 'Room full.' })
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
      }
      syncLobby()
      if (authState) conns.get(fromId)?.send({ t: 'start', state: authState })
      return
    }
    if (msg.t === 'lobby') {
      seats = msg.seats
      theater = msg.theater
      align = msg.align
      playerCount = msg.playerCount
      difficulty = msg.difficulty
      status = `Room ${msg.roomCode}`
      notify()
      return
    }
    if (msg.t === 'ready' && isHost) {
      seats = seats.map((s) => (s.id === msg.id ? { ...s, ready: msg.ready } : s))
      syncLobby()
      return
    }
    if (msg.t === 'start' || msg.t === 'state') {
      viewState = msg.state
      status = 'In match'
      notify()
      return
    }
    if (msg.t === 'move' && isHost) {
      applyHostMove(msg.move)
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
  }

  if (isHost) {
    peer.on('connection', (conn) => {
      attach(conn)
    })
  } else if (hostConn) {
    attach(hostConn)
    send(hostConn, {
      t: 'hello',
      id: localId,
      name: playerName,
      avatarUid: localAvatarUid,
      seat: localSeat,
    })
  }

  return {
    get roomCode() {
      return code
    },
    get isHost() {
      return isHost
    },
    get localId() {
      return localId
    },
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
    get theater() {
      return theater
    },
    get align() {
      return align
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
        hostConn?.send({ t: 'ready', id: localId, ready })
      }
    },
    setTheater: (t) => {
      if (!isHost) return
      theater = t
      syncLobby()
    },
    setAlign: (a) => {
      if (!isHost) return
      align = a
      playerCount = clampPlayerCount(playerCount, align)
      syncLobby()
    },
    setPlayerCount: (n) => {
      if (!isHost) return
      playerCount = clampPlayerCount(n, align)
      syncLobby()
    },
    setDifficulty: (d) => {
      if (!isHost) return
      difficulty = d
      syncLobby()
    },
    startMatch: (occupants = []) => {
      if (!isHost) return
      const roster = warfrontMpRoster(occupants, playerCount, align)
      authState = withPhysicalSeats(
        createWarfrontMatch(
          roster.names,
          roster.computers,
          theater,
          align,
          difficulty,
        ),
        roster.seats,
      )
      authState = fillWarfrontBots(authState, { maxSteps: 0 })
      viewState = authState
      broadcast({ t: 'start', state: authState })
      status = 'In match'
      notify()
      scheduleBots()
    },
    submit: (move) => {
      if (isHost) return applyHostMove(move)
      if (!hostConn) return { ok: false, error: 'Not connected' }
      hostConn.send({ t: 'move', move })
      return { ok: true }
    },
    destroy: () => {
      clearBotTimer()
      listeners.clear()
      try {
        peer.destroy()
      } catch {
        /* ignore */
      }
    },
  }
}
