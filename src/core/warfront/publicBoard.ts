import { stackCount, stackWire } from './stacks'
import type {
  WarfrontPhase,
  WarfrontState,
  WarfrontTheater,
  WarfrontAlign,
} from './types'

export type WarfrontPublicPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  teamId: 'A' | 'B' | null
  pp: number
  vp: number
  eliminated: boolean
}

export type WarfrontPublicZone = {
  ownerSeat: number
  facility: boolean
  stackN: number
}

export type WarfrontPublicBoard = {
  live: boolean
  theater: WarfrontTheater
  align: WarfrontAlign
  playerCount: number
  phase: WarfrontPhase | 'idle'
  turnPlayerId: string | null
  turnName: string
  lastMessage: string
  players: WarfrontPublicPlayer[]
  zones: WarfrontPublicZone[]
  /** Layout for spectator (copied from state; small). */
  layout: { x: number; y: number }[]
  winnerId: string | null
  winnerTeamId: 'A' | 'B' | null
  round: number
}

function clip(raw: string, n: number): string {
  const s = raw.replace(/[~|^,:&?#]/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : s.slice(0, n)
}

function phaseWire(p: WarfrontPhase | 'idle'): string {
  if (p === 'income') return 'i'
  if (p === 'buy') return 'b'
  if (p === 'ranged') return 'r'
  if (p === 'move') return 'm'
  if (p === 'gameEnd') return 'e'
  return 'z'
}

function parsePhase(ch: string): WarfrontPhase | 'idle' {
  if (ch === 'i') return 'income'
  if (ch === 'b') return 'buy'
  if (ch === 'r') return 'ranged'
  if (ch === 'm') return 'move'
  if (ch === 'e') return 'gameEnd'
  return 'idle'
}

/**
 * Compact BOARD wire (no JSON). Prefix `W1~`.
 * W1~live~theater~align~pc~phase~turnSeat~msg~winSeat~winTeam~round^players^zones
 * zone token: ownerSeat|f|stackN   (ownerSeat=- for none, f=1/0)
 */
export function encodeWarfrontPublicBoard(board: WarfrontPublicBoard): string {
  if (!board.live && board.phase === 'idle') return 'W1~0~'
  const turnSeat =
    board.players.find((p) => p.id === board.turnPlayerId)?.seat ?? -1
  const winSeat =
    board.players.find((p) => p.id === board.winnerId)?.seat ?? -1
  const head = [
    'W1',
    board.phase === 'gameEnd' ? '0' : '1',
    board.theater === 'sea' ? 's' : 'l',
    board.align === 'teams' ? 't' : 'f',
    String(board.playerCount),
    phaseWire(board.phase),
    turnSeat < 0 ? '-' : String(turnSeat),
    clip(board.lastMessage, 40),
    winSeat < 0 ? '-' : String(winSeat),
    board.winnerTeamId ?? '-',
    String(board.round),
  ].join('~')

  const players = board.players
    .map((p) =>
      [
        clip(p.name, 10),
        String(p.seat),
        p.isComputer ? '1' : '0',
        p.teamId ?? '-',
        String(p.pp),
        String(p.vp),
        p.eliminated ? '1' : '0',
      ].join(':'),
    )
    .join(',')

  const zones = board.zones
    .map((z) => {
      const o = z.ownerSeat < 0 ? '-' : String(z.ownerSeat)
      return `${o}${z.facility ? '1' : '0'}${z.stackN.toString(36)}`
    })
    .join('')

  return `${head}^${players}^${zones}`
}

export function isWarfrontBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('W1~')
}

export function decodeWarfrontPublicBoard(raw: string): WarfrontPublicBoard {
  const text = raw.trim()
  if (!text.startsWith('W1~')) return idleWarfrontPublicBoard()
  const [headPart, playersPart = '', zonesPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0' && head.length < 5) return idleWarfrontPublicBoard()
  if (head.length < 11) return idleWarfrontPublicBoard()

  const players: WarfrontPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const p = tok.split(':')
      if (p.length < 7) return null
      const seat = Number(p[1])
      if (!Number.isFinite(seat)) return null
      const team = p[3] === 'A' || p[3] === 'B' ? p[3] : null
      return {
        id: `p${seat}`,
        name: clip(p[0] || `P${seat + 1}`, 12),
        seat,
        isComputer: p[2] === '1',
        teamId: team,
        pp: Number(p[4]) || 0,
        vp: Number(p[5]) || 0,
        eliminated: p[6] === '1',
      }
    })
    .filter((p): p is WarfrontPublicPlayer => Boolean(p))

  const zones: WarfrontPublicZone[] = []
  let i = 0
  while (i < zonesPart.length) {
    let ownerSeat = -1
    if (zonesPart[i] === '-') {
      i += 1
    } else {
      ownerSeat = Number(zonesPart[i])
      i += 1
    }
    const facility = zonesPart[i] === '1'
    i += 1
    const stackN = parseInt(zonesPart[i] || '0', 36) || 0
    i += 1
    zones.push({ ownerSeat: Number.isFinite(ownerSeat) ? ownerSeat : -1, facility, stackN })
  }

  const turnSeat = head[6] === '-' ? -1 : Number(head[6])
  const winSeat = head[8] === '-' ? -1 : Number(head[8])
  const winTeam = head[9] === 'A' || head[9] === 'B' ? head[9] : null
  const phase = parsePhase(head[5] || 'z')

  // Layout reconstructed as empty — spectator can use equal grid if missing
  const layout = zones.map((_, zi) => {
    const col = zi % 7
    const row = Math.floor(zi / 7)
    return { x: col / 6, y: row / 4 }
  })

  return {
    live: head[1] !== '0' || phase === 'gameEnd',
    theater: head[2] === 's' ? 'sea' : 'land',
    align: head[3] === 't' ? 'teams' : 'ffa',
    playerCount: Number(head[4]) || players.length || 2,
    phase,
    turnPlayerId: turnSeat >= 0 ? `p${turnSeat}` : null,
    turnName: players.find((p) => p.seat === turnSeat)?.name ?? '',
    lastMessage: clip(head[7] || '', 48),
    players,
    zones,
    layout,
    winnerId: winSeat >= 0 ? `p${winSeat}` : null,
    winnerTeamId: winTeam,
    round: Number(head[10]) || 1,
  }
}

export function idleWarfrontPublicBoard(): WarfrontPublicBoard {
  return {
    live: false,
    theater: 'land',
    align: 'ffa',
    playerCount: 0,
    phase: 'idle',
    turnPlayerId: null,
    turnName: '',
    lastMessage: '',
    players: [],
    zones: [],
    layout: [],
    winnerId: null,
    winnerTeamId: null,
    round: 0,
  }
}

export function warfrontPublicBoardFromState(
  state: WarfrontState,
): WarfrontPublicBoard {
  const players: WarfrontPublicPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: clip(p.name, 12),
    seat: p.seat,
    isComputer: p.isComputer,
    teamId: p.teamId,
    pp: p.pp,
    vp: p.vp,
    eliminated: p.eliminated,
  }))

  const seatOf = (id: string | null) =>
    id == null ? -1 : (state.players.find((p) => p.id === id)?.seat ?? -1)

  const zones: WarfrontPublicZone[] = state.zones.map((z) => ({
    ownerSeat: seatOf(z.ownerId),
    facility: z.facility,
    stackN: stackCount(z.units),
  }))

  const turn = state.players.find((p) => p.id === state.turnPlayerId)

  return {
    live: state.phase !== 'gameEnd',
    theater: state.config.theater,
    align: state.config.align,
    playerCount: state.config.playerCount,
    phase: state.phase,
    turnPlayerId: state.turnPlayerId,
    turnName: turn ? clip(turn.name, 12) : '',
    lastMessage: clip(state.lastMessage ?? '', 48),
    players,
    zones,
    layout: state.layout.map((p) => ({ ...p })),
    winnerId: state.winnerId,
    winnerTeamId: state.winnerTeamId,
    round: state.round,
  }
}

/** Debug helper — include stack wire in private views only. */
export function zoneStackDebug(state: WarfrontState, zoneId: number): string {
  return stackWire(state.zones[zoneId]?.units ?? {})
}
