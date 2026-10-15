import { kindLabel } from './compare'
import type {
  RowShamBoDirection,
  RowShamBoKind,
  RowShamBoPhase,
  RowShamBoState,
  RowShamBoVariant,
} from './types'
import { rowShamBoVariantLabel } from './variants'

export type RowShamBoPublicPlayer = {
  name: string
  seat: number
  handCount: number
  gameScore: number
  matchScore: number
}

export type RowShamBoPublicBoard = {
  live: boolean
  variant: RowShamBoVariant
  playerCount: number
  handNumber: number
  gameNumber: number
  playTo: number
  phase: RowShamBoPhase | 'idle'
  buttonSeat: number
  direction: RowShamBoDirection | null
  stockCount: number
  players: RowShamBoPublicPlayer[]
  lastMessage: string
}

function clipName(raw: string): string {
  const s = raw.replace(/[|,:^~&?#]/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length <= 16 ? s : s.slice(0, 16)
}

function clipMsg(raw: string): string {
  const s = raw.replace(/[|&?#]/g, '/').replace(/~/g, '-').trim()
  return s.length <= 72 ? s : s.slice(0, 72)
}

function variantWire(v: RowShamBoVariant): string {
  if (v === 'triples') return 't'
  if (v === 'elements') return 'e'
  return 'c'
}

function parseVariantWire(ch: string): RowShamBoVariant {
  if (ch === 't') return 'triples'
  if (ch === 'e') return 'elements'
  return 'classic'
}

function phaseCode(p: RowShamBoPhase | 'idle'): string {
  if (p === 'chooseDir') return 'd'
  if (p === 'pass') return 'p'
  if (p === 'play') return 'y'
  if (p === 'reveal' || p === 'resolve') return 'r'
  if (p === 'handEnd') return 'h'
  if (p === 'gameEnd') return 'e'
  if (p === 'matchEnd') return 'g'
  if (p === 'draw') return 'w'
  return 'i'
}

function parsePhase(ch: string): RowShamBoPhase | 'idle' {
  if (ch === 'd') return 'chooseDir'
  if (ch === 'p') return 'pass'
  if (ch === 'y') return 'play'
  if (ch === 'r') return 'resolve'
  if (ch === 'h') return 'handEnd'
  if (ch === 'e') return 'gameEnd'
  if (ch === 'g') return 'matchEnd'
  if (ch === 'w') return 'draw'
  return 'idle'
}

export function idleRowShamBoPublicBoard(): RowShamBoPublicBoard {
  return {
    live: false,
    variant: 'classic',
    playerCount: 2,
    handNumber: 0,
    gameNumber: 0,
    playTo: 100,
    phase: 'idle',
    buttonSeat: -1,
    direction: null,
    stockCount: 0,
    players: [],
    lastMessage: '',
  }
}

export function rowShamBoPublicBoardFromState(state: RowShamBoState): RowShamBoPublicBoard {
  return {
    live: state.phase !== 'matchEnd',
    variant: state.config.variant,
    playerCount: state.config.playerCount,
    handNumber: state.handNumber,
    gameNumber: state.gameNumber,
    playTo: state.config.playTo,
    phase: state.phase,
    buttonSeat: state.players[state.button]?.seat ?? state.button,
    direction: state.direction,
    stockCount: state.stock.length,
    players: state.players.map((p) => ({
      name: clipName(p.name),
      seat: p.seat,
      handCount: p.hand.length,
      gameScore: p.gameScore,
      matchScore: p.matchScore,
    })),
    lastMessage: clipMsg(state.lastMessage || state.log[state.log.length - 1] || ''),
  }
}

/** Compact pipe for BOARD chunks. Prefix `W1~`. */
export function encodeRowShamBoPublicBoard(board: RowShamBoPublicBoard): string {
  if (!board.live) return 'W1~0~'
  const dir = board.direction === 'cw' ? 'c' : board.direction === 'ccw' ? 'a' : '-'
  const head = [
    'W1',
    '1',
    variantWire(board.variant),
    String(board.playerCount),
    String(board.handNumber),
    String(board.gameNumber),
    String(board.playTo),
    phaseCode(board.phase),
    board.buttonSeat < 0 ? '-' : String(board.buttonSeat),
    dir,
    String(board.stockCount),
    clipMsg(board.lastMessage),
  ].join('~')
  const players = board.players
    .map(
      (p) =>
        `${clipName(p.name)}:${p.seat}:${p.handCount}:${p.gameScore}:${p.matchScore}`,
    )
    .join(',')
  return `${head}^${players}`
}

export function isRowShamBoBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('W1~')
}

export function decodeRowShamBoPublicBoard(raw: string): RowShamBoPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('W1~')) return idleRowShamBoPublicBoard()
  const [headPart, playersPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0') return idleRowShamBoPublicBoard()
  if (head.length < 11) return idleRowShamBoPublicBoard()

  const dirCh = head[9]!
  const players: RowShamBoPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const parts = tok.split(':')
      if (parts.length < 4) return null
      const seat = Number(parts[1])
      if (!Number.isFinite(seat) || seat < 0 || seat > 3) return null
      return {
        name: clipName(parts[0] || `P${seat + 1}`),
        seat,
        handCount: Number(parts[2]) || 0,
        gameScore: Number(parts[3]) || 0,
        matchScore: Number(parts[4]) || 0,
      }
    })
    .filter((p): p is RowShamBoPublicPlayer => Boolean(p))

  return {
    live: true,
    variant: parseVariantWire(head[2] || 'c'),
    playerCount: Number(head[3]) || players.length || 2,
    handNumber: Number(head[4]) || 1,
    gameNumber: Number(head[5]) || 1,
    playTo: Number(head[6]) || 100,
    phase: parsePhase(head[7] || 'i'),
    buttonSeat: head[8] === '-' ? -1 : Number(head[8]),
    direction: dirCh === 'c' ? 'cw' : dirCh === 'a' ? 'ccw' : null,
    stockCount: Number(head[10]) || 0,
    players,
    lastMessage: clipMsg(head[11] || ''),
  }
}

export function rowShamBoSpectatorStatus(board: RowShamBoPublicBoard): string {
  if (!board.live) return 'Row! Sham! Bo! parlor open — waiting'
  if (board.phase === 'pass') return 'Passing cards…'
  if (board.phase === 'play') return 'Playing face-down…'
  if (board.phase === 'resolve' || board.phase === 'reveal') return 'Battle!'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || rowShamBoVariantLabel(board.variant)
}

export function kindGlyph(k: RowShamBoKind): string {
  if (k === 'rock') return '✊'
  if (k === 'paper') return '✋'
  if (k === 'scissors') return '✌'
  if (k === 'dynamite') return '💥'
  if (k === 'water') return '💧'
  if (k === 'earth') return '⛰'
  return '🔥'
}

export { kindLabel, rowShamBoVariantLabel }
