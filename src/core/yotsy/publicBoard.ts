import { playerTotal } from './score'
import type { YotsyPhase, YotsyState, YotsyVariant } from './types'
import { normalizeYotsyVariant, yotsyVariantLabel } from './variants'

export type YotsyPublicPlayer = {
  name: string
  seat: number
  total: number
  turnsDone: number
}

export type YotsyPublicBoard = {
  live: boolean
  variant: YotsyVariant
  playerCount: number
  round: number
  phase: YotsyPhase | 'idle'
  currentSeat: number
  dice: number[]
  rollsLeft: number
  players: YotsyPublicPlayer[]
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

function phaseCode(p: YotsyPhase | 'idle'): string {
  if (p === 'play') return 'y'
  if (p === 'matchEnd') return 'g'
  return 'i'
}

function parsePhase(ch: string): YotsyPhase | 'idle' {
  if (ch === 'y') return 'play'
  if (ch === 'g') return 'matchEnd'
  return 'idle'
}

function variantWire(v: YotsyVariant): string {
  if (v === 'kismet') return 'k'
  if (v === 'yacht') return 'y'
  if (v === 'generala') return 'g'
  return 'c'
}

function parseVariantWire(ch: string): YotsyVariant {
  // Legacy stub used `d` for Dismet → Kismet
  if (ch === 'k' || ch === 'd') return 'kismet'
  if (ch === 'y') return 'yacht'
  if (ch === 'g') return 'generala'
  return 'classic'
}

export function idleYotsyPublicBoard(): YotsyPublicBoard {
  return {
    live: false,
    variant: 'classic',
    playerCount: 2,
    round: 0,
    phase: 'idle',
    currentSeat: -1,
    dice: [],
    rollsLeft: 0,
    players: [],
    lastMessage: '',
  }
}

export function yotsyPublicBoardFromState(state: YotsyState): YotsyPublicBoard {
  const cur = state.players[state.current]
  const turnSeat = state.phase === 'matchEnd' || !cur ? -1 : cur.seat
  const variant = normalizeYotsyVariant(state.config.variant)
  return {
    live: state.phase !== 'matchEnd',
    variant,
    playerCount: state.config.playerCount,
    round: state.round,
    phase: state.phase,
    currentSeat: turnSeat,
    dice: state.hasRolled ? state.dice.map((d) => d.value) : [],
    rollsLeft: state.rollsLeft,
    players: state.players.map((p) => ({
      name: clipName(p.name),
      seat: p.seat,
      total: playerTotal(p, variant),
      turnsDone: p.turnsDone,
    })),
    lastMessage: clipMsg(state.lastMessage || state.lastScoreNote || state.log[state.log.length - 1] || ''),
  }
}

/** Compact pipe for BOARD chunks. Prefix `Y1~` distinguishes Yotsy. */
export function encodeYotsyPublicBoard(board: YotsyPublicBoard): string {
  if (!board.live) return 'Y1~0~'
  const turn = board.currentSeat < 0 ? '-' : String(board.currentSeat)
  const dice = board.dice.length ? board.dice.join(',') : '-'
  const head = [
    'Y1',
    '1',
    variantWire(board.variant),
    String(board.playerCount),
    String(board.round),
    phaseCode(board.phase),
    turn,
    dice,
    String(board.rollsLeft),
    clipMsg(board.lastMessage),
  ].join('~')
  const players = board.players
    .map((p) => `${clipName(p.name)}:${p.seat}:${p.total}:${p.turnsDone}`)
    .join(',')
  return `${head}^${players}`
}

export function isYotsyBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('Y1~')
}

export function decodeYotsyPublicBoard(raw: string): YotsyPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('Y1~')) return idleYotsyPublicBoard()
  const [headPart, playersPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0') return idleYotsyPublicBoard()
  if (head.length < 9) return idleYotsyPublicBoard()

  const turnRaw = head[6]!
  const diceRaw = head[7] || '-'
  const players: YotsyPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const parts = tok.split(':')
      if (parts.length < 3) return null
      const seat = Number(parts[1])
      if (!Number.isFinite(seat) || seat < 0 || seat > 3) return null
      return {
        name: clipName(parts[0] || `P${seat + 1}`),
        seat,
        total: Number(parts[2]) || 0,
        turnsDone: Number(parts[3]) || 0,
      }
    })
    .filter((p): p is YotsyPublicPlayer => Boolean(p))

  return {
    live: true,
    variant: parseVariantWire(head[2] || 'c'),
    playerCount: Number(head[3]) || players.length || 2,
    round: Number(head[4]) || 1,
    phase: parsePhase(head[5] || 'i'),
    currentSeat: turnRaw === '-' ? -1 : Number(turnRaw),
    dice: diceRaw === '-' ? [] : diceRaw.split(',').map((x) => Number(x) || 1),
    rollsLeft: Number(head[8]) || 0,
    players,
    lastMessage: clipMsg(head[9] || ''),
  }
}

export { yotsyVariantLabel }

export function yotsySpectatorStatus(board: YotsyPublicBoard): string {
  if (!board.live) return 'Yotsy parlor open — waiting for a game'
  const who = (() => {
    const p = board.players.find((x) => x.seat === board.currentSeat)
    if (p?.name) return `${p.name} (Player ${board.currentSeat + 1})`
    if (board.currentSeat >= 0) return `Player ${board.currentSeat + 1}`
    return 'Someone'
  })()
  if (board.phase === 'play') return `${who}'s turn`
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || 'Yotsy'
}
