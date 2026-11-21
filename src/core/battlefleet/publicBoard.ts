import { cellKey } from './board'
import { remainingCells, survivingShipCount } from './fleet'
import { fleetForSide } from './state'
import type {
  BattleFleetPhase,
  BattleFleetState,
  Cell,
  ShipKind,
  Shot,
} from './types'

export type PublicCellMark = 'miss' | 'hit' | 'sunk'

export type BattleFleetPublicPlayer = {
  id: string
  name: string
  seat: number
  isComputer: boolean
  teamId: 'A' | 'B' | null
  eliminated: boolean
  shipsLeft: number
  cellsLeft: number
  hits: number
  misses: number
  shipsSunk: number
  score: number
}

export type BattleFleetPublicSunkShip = {
  sideId: string
  kind: ShipKind
  cells: Cell[]
}

export type BattleFleetPublicBoard = {
  live: boolean
  mode: 'ffa' | 'teams'
  playerCount: number
  phase: BattleFleetPhase | 'idle'
  turnPlayerId: string | null
  turnName: string
  lastMessage: string
  players: BattleFleetPublicPlayer[]
  /** Global cell marks from public shots. */
  marks: { x: number; y: number; mark: PublicCellMark }[]
  sunkShips: BattleFleetPublicSunkShip[]
  winnerId: string | null
  winnerTeamId: 'A' | 'B' | null
  recentShot: Shot | null
}

function clip(raw: string, n: number): string {
  const s = raw.replace(/[~|^,:&?#]/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : s.slice(0, n)
}

function phaseWire(p: BattleFleetPhase | 'idle'): string {
  if (p === 'placement') return 'p'
  if (p === 'battle') return 'b'
  if (p === 'gameEnd') return 'e'
  if (p === 'setup') return 's'
  return 'i'
}

function parsePhase(ch: string): BattleFleetPhase | 'idle' {
  if (ch === 'p') return 'placement'
  if (ch === 'b') return 'battle'
  if (ch === 'e') return 'gameEnd'
  if (ch === 's') return 'setup'
  return 'idle'
}

function kindWire(k: ShipKind): string {
  if (k === 'carrier') return 'C'
  if (k === 'battleship') return 'B'
  if (k === 'cruiser') return 'R'
  if (k === 'submarine') return 'U'
  return 'D'
}

function parseKind(ch: string): ShipKind {
  if (ch === 'C') return 'carrier'
  if (ch === 'B') return 'battleship'
  if (ch === 'R') return 'cruiser'
  if (ch === 'U') return 'submarine'
  return 'destroyer'
}

function cellIdx(x: number, y: number): number {
  return y * 20 + x
}

function fromIdx(i: number): Cell {
  return { x: i % 20, y: Math.floor(i / 20) }
}

/** 2-char base36 cell index (00–b4 covers 0–399). */
function encIdx(i: number): string {
  return Math.max(0, Math.min(399, i)).toString(36).padStart(2, '0')
}

function decIdx(s: string): number {
  const n = parseInt(s, 36)
  return Number.isFinite(n) ? n : -1
}

function markWire(m: PublicCellMark): string {
  if (m === 'miss') return 'm'
  if (m === 'sunk') return 's'
  return 'h'
}

function parseMark(ch: string): PublicCellMark {
  if (ch === 'm') return 'miss'
  if (ch === 's') return 'sunk'
  return 'hit'
}

/**
 * Compact BOARD wire (no JSON). Prefix `F1~`.
 * Avoids Parlor_Http stack-heap from embedding large escaped JSON in status.
 *
 * F1~live~mode~pc~phase~turnSeat~turnName~msg~winSeat~winTeam^players^marks^sunk
 */
export function encodeBattleFleetPublicBoard(board: BattleFleetPublicBoard): string {
  if (!board.live && board.phase === 'idle') return 'F1~0~'
  const turnSeat =
    board.players.find((p) => p.id === board.turnPlayerId)?.seat ?? -1
  const winSeat =
    board.players.find((p) => p.id === board.winnerId)?.seat ?? -1
  const head = [
    'F1',
    board.phase === 'gameEnd' ? '0' : '1',
    board.mode === 'teams' ? 't' : 'f',
    String(board.playerCount),
    phaseWire(board.phase),
    turnSeat < 0 ? '-' : String(turnSeat),
    clip(board.turnName, 12),
    clip(board.lastMessage, 48),
    winSeat < 0 ? '-' : String(winSeat),
    board.winnerTeamId ?? '-',
  ].join('~')

  const players = board.players
    .map((p) =>
      [
        clip(p.name, 12),
        String(p.seat),
        p.isComputer ? '1' : '0',
        p.teamId ?? '-',
        p.eliminated ? '1' : '0',
        String(p.shipsLeft),
        String(p.cellsLeft),
        String(p.hits),
        String(p.misses),
        String(p.shipsSunk),
        String(p.score),
      ].join(':'),
    )
    .join(',')

  // Deduplicate marks; sunk wins over hit
  const markMap = new Map<number, PublicCellMark>()
  for (const m of board.marks) {
    const i = cellIdx(m.x, m.y)
    const prev = markMap.get(i)
    if (prev === 'sunk') continue
    if (m.mark === 'sunk' || !prev) markMap.set(i, m.mark)
  }
  let marks = ''
  for (const [i, m] of markMap) {
    marks += encIdx(i) + markWire(m)
  }

  const sunk = board.sunkShips
    .map((s) => {
      const side =
        s.sideId === 'A' || s.sideId === 'B'
          ? s.sideId
          : String(board.players.find((p) => p.id === s.sideId)?.seat ?? s.sideId)
      const cells = s.cells.map((c) => encIdx(cellIdx(c.x, c.y))).join('.')
      return `${side}${kindWire(s.kind)}:${cells}`
    })
    .join(',')

  return `${head}^${players}^${marks}^${sunk}`
}

export function isBattleFleetBoardPayload(raw: string): boolean {
  const t = raw.trim()
  if (t.startsWith('F1~')) return true
  // Legacy JSON payloads (pre-compact) — still detect so old tables don't crash UI
  if (!t.startsWith('{')) return false
  try {
    const o = JSON.parse(t) as { mode?: string; marks?: unknown; players?: unknown }
    return (
      (o.mode === 'ffa' || o.mode === 'teams') &&
      Array.isArray(o.marks) &&
      Array.isArray(o.players)
    )
  } catch {
    return false
  }
}

export function decodeBattleFleetPublicBoard(raw: string): BattleFleetPublicBoard {
  const text = raw.trim()
  if (!text) return idleBattleFleetPublicBoard()

  if (text.startsWith('{')) {
    try {
      return JSON.parse(text) as BattleFleetPublicBoard
    } catch {
      return idleBattleFleetPublicBoard()
    }
  }

  if (!text.startsWith('F1~')) return idleBattleFleetPublicBoard()
  const [headPart, playersPart = '', marksPart = '', sunkPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0' && head.length < 5) return idleBattleFleetPublicBoard()
  if (head.length < 10) return idleBattleFleetPublicBoard()

  const players: BattleFleetPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const p = tok.split(':')
      if (p.length < 11) return null
      const seat = Number(p[1])
      if (!Number.isFinite(seat)) return null
      const team = p[3] === 'A' || p[3] === 'B' ? p[3] : null
      return {
        id: `p${seat}`,
        name: clip(p[0] || `P${seat + 1}`, 16),
        seat,
        isComputer: p[2] === '1',
        teamId: team,
        eliminated: p[4] === '1',
        shipsLeft: Number(p[5]) || 0,
        cellsLeft: Number(p[6]) || 0,
        hits: Number(p[7]) || 0,
        misses: Number(p[8]) || 0,
        shipsSunk: Number(p[9]) || 0,
        score: Number(p[10]) || 0,
      }
    })
    .filter((p): p is BattleFleetPublicPlayer => Boolean(p))

  const marks: BattleFleetPublicBoard['marks'] = []
  for (let i = 0; i + 2 < marksPart.length; i += 3) {
    const idx = decIdx(marksPart.slice(i, i + 2))
    if (idx < 0) continue
    const cell = fromIdx(idx)
    marks.push({ x: cell.x, y: cell.y, mark: parseMark(marksPart[i + 2]!) })
  }

  const sunkShips: BattleFleetPublicSunkShip[] = (sunkPart || '')
    .split(',')
    .map((tok) => {
      if (!tok) return null
      const [left, cellsStr = ''] = tok.split(':')
      if (!left || left.length < 2) return null
      const sideRaw = left.slice(0, -1)
      const kind = parseKind(left.slice(-1))
      const sideId =
        sideRaw === 'A' || sideRaw === 'B' ? sideRaw : `p${sideRaw}`
      const cells = cellsStr
        .split('.')
        .map((s) => decIdx(s))
        .filter((n) => n >= 0)
        .map(fromIdx)
      return { sideId, kind, cells }
    })
    .filter((s): s is BattleFleetPublicSunkShip => Boolean(s))

  const turnSeat = head[5] === '-' ? -1 : Number(head[5])
  const winSeat = head[8] === '-' ? -1 : Number(head[8])
  const winTeam = head[9] === 'A' || head[9] === 'B' ? head[9] : null
  const phase = parsePhase(head[4] || 'i')

  return {
    live: head[1] !== '0' || phase === 'gameEnd',
    mode: head[2] === 't' ? 'teams' : 'ffa',
    playerCount: Number(head[3]) || players.length || 2,
    phase,
    turnPlayerId: turnSeat >= 0 ? `p${turnSeat}` : null,
    turnName: clip(head[6] || '', 16),
    lastMessage: clip(head[7] || '', 72),
    players,
    marks,
    sunkShips,
    winnerId: winSeat >= 0 ? `p${winSeat}` : null,
    winnerTeamId: winTeam,
    recentShot: null,
  }
}

export function idleBattleFleetPublicBoard(): BattleFleetPublicBoard {
  return {
    live: false,
    mode: 'ffa',
    playerCount: 0,
    phase: 'idle',
    turnPlayerId: null,
    turnName: '',
    lastMessage: '',
    players: [],
    marks: [],
    sunkShips: [],
    winnerId: null,
    winnerTeamId: null,
    recentShot: null,
  }
}

export function battleFleetPublicBoardFromState(
  state: BattleFleetState,
): BattleFleetPublicBoard {
  const players: BattleFleetPublicPlayer[] = state.players.map((p) => {
    const sideId =
      state.config.mode === 'teams' && p.teamId ? p.teamId : p.id
    const fleet = fleetForSide(state, sideId)
    return {
      id: p.id,
      name: clip(p.name, 16),
      seat: p.seat,
      isComputer: p.isComputer,
      teamId: p.teamId,
      eliminated: p.eliminated,
      shipsLeft: fleet ? survivingShipCount(fleet) : 0,
      cellsLeft: fleet ? remainingCells(fleet) : 0,
      hits: p.hits,
      misses: p.misses,
      shipsSunk: p.shipsSunk,
      score: p.score,
    }
  })

  const marks: BattleFleetPublicBoard['marks'] = []
  const seen = new Set<string>()
  for (const s of state.shots) {
    const k = cellKey(s.x, s.y)
    if (seen.has(k)) continue
    seen.add(k)
    const mark: PublicCellMark =
      s.result === 'miss' ? 'miss' : s.result === 'sunk' ? 'sunk' : 'hit'
    marks.push({ x: s.x, y: s.y, mark })
  }
  // Upgrade hit cells that belong to sunk ships to sunk
  const sunkShips: BattleFleetPublicSunkShip[] = []
  const sides =
    state.config.mode === 'teams'
      ? (state.teams ?? []).map((t) => t.id)
      : state.players.map((p) => p.id)
  for (const sideId of sides) {
    const fleet = fleetForSide(state, sideId)
    if (!fleet) continue
    for (const ship of fleet.ships) {
      if (!ship.sunk) continue
      sunkShips.push({ sideId, kind: ship.kind, cells: ship.cells })
      for (const c of ship.cells) {
        const m = marks.find((x) => x.x === c.x && x.y === c.y)
        if (m) m.mark = 'sunk'
        else marks.push({ x: c.x, y: c.y, mark: 'sunk' })
      }
    }
  }

  const turn = state.players.find((p) => p.id === state.turnPlayerId)

  return {
    live: state.phase !== 'gameEnd',
    mode: state.config.mode,
    playerCount: state.config.playerCount,
    phase: state.phase,
    turnPlayerId: state.turnPlayerId,
    turnName: turn ? clip(turn.name, 16) : '',
    lastMessage: clip(state.lastMessage ?? '', 72),
    players,
    marks,
    sunkShips,
    winnerId: state.winnerId,
    winnerTeamId: state.winnerTeamId,
    recentShot: state.shots.length ? state.shots[state.shots.length - 1]! : null,
  }
}

/**
 * Private HUD view for one player: own (or team) fleet cells + public marks.
 */
export function battleFleetPrivateView(
  state: BattleFleetState,
  viewerId: string,
): {
  public: BattleFleetPublicBoard
  ownShipCells: Cell[]
  ownHits: Cell[]
} {
  const pub = battleFleetPublicBoardFromState(state)
  const pl = state.players.find((p) => p.id === viewerId)
  const sideId =
    state.config.mode === 'teams' && pl?.teamId ? pl.teamId : viewerId
  const fleet = fleetForSide(state, sideId)
  const ownShipCells: Cell[] = []
  const ownHits: Cell[] = []
  if (fleet) {
    for (const s of fleet.ships) {
      for (const c of s.cells) ownShipCells.push(c)
      for (const h of s.hits) ownHits.push(h)
    }
  }
  return { public: pub, ownShipCells, ownHits }
}

/**
 * Strip living enemy ships before sending state over the peer wire.
 * Sunk ships stay (already public). Viewer keeps own / team fleet intact.
 */
export function sanitizeBattleFleetForViewer(
  state: BattleFleetState,
  viewerId: string,
): BattleFleetState {
  const next = structuredClone(state)
  const viewer = next.players.find((p) => p.id === viewerId)
  const viewerSide =
    next.config.mode === 'teams' && viewer?.teamId ? viewer.teamId : viewerId

  if (next.config.mode === 'teams') {
    for (const team of next.teams ?? []) {
      if (team.id === viewerSide) continue
      team.fleet = {
        confirmed: team.fleet.confirmed,
        ships: team.fleet.ships.filter((s) => s.sunk),
      }
    }
  } else {
    for (const p of next.players) {
      if (p.id === viewerId || !p.fleet) continue
      p.fleet = {
        confirmed: p.fleet.confirmed,
        ships: p.fleet.ships.filter((s) => s.sunk),
      }
    }
  }
  return next
}
