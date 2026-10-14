import { encodePhaseItFace, parsePhaseItFace } from './deck'
import { phaseLabel } from './phases'
import type { PhaseItCard, PhaseItPhase, PhaseItState, PhaseItVariant } from './types'
import { phaseItVariantLabel } from './variants'

function variantWire(v: PhaseItVariant): string {
  if (v === 'masters') return 'm'
  if (v === 'sprint') return 's'
  return 'c'
}

function parseVariantWire(ch: string): PhaseItVariant {
  if (ch === 'm') return 'masters'
  if (ch === 's') return 'sprint'
  return 'classic'
}

export type PhaseItPublicPlayer = {
  name: string
  seat: number
  handCount: number
  score: number
  /** Active phase index (−1 = Masters choose; winN = complete). */
  phase: number
  phaseDown: boolean
}

export type PhaseItPublicBoard = {
  live: boolean
  variant: PhaseItVariant
  playerCount: number
  round: number
  playTo: number | null
  phase: PhaseItPhase | 'idle'
  currentSeat: number
  topDiscard: PhaseItCard | null
  stockCount: number
  players: PhaseItPublicPlayer[]
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

function phaseCode(p: PhaseItPhase | 'idle'): string {
  if (p === 'play') return 'y'
  if (p === 'roundEnd') return 'e'
  if (p === 'matchEnd') return 'g'
  return 'i'
}

function parsePhase(ch: string): PhaseItPhase | 'idle' {
  if (ch === 'y') return 'play'
  if (ch === 'e') return 'roundEnd'
  if (ch === 'g') return 'matchEnd'
  return 'idle'
}

export function idlePhaseItPublicBoard(): PhaseItPublicBoard {
  return {
    live: false,
    variant: 'classic',
    playerCount: 4,
    round: 0,
    playTo: null,
    phase: 'idle',
    currentSeat: -1,
    topDiscard: null,
    stockCount: 0,
    players: [],
    lastMessage: '',
  }
}

export function phaseItPublicBoardFromState(state: PhaseItState): PhaseItPublicBoard {
  const cur = state.players[state.current]
  const turnSeat =
    state.phase === 'roundEnd' || state.phase === 'matchEnd' || !cur ? -1 : cur.seat
  return {
    live: state.phase !== 'matchEnd',
    variant: state.config.variant,
    playerCount: state.config.playerCount,
    round: state.round,
    playTo: state.config.playTo,
    phase: state.phase,
    currentSeat: turnSeat,
    topDiscard: state.discard[state.discard.length - 1] ?? null,
    stockCount: state.stock.length,
    players: state.players.map((p) => ({
      name: clipName(p.name),
      seat: p.seat,
      handCount: p.hand.length,
      score: p.score,
      phase: p.phase,
      phaseDown: p.phaseDown,
    })),
    lastMessage: clipMsg(state.lastMessage || state.lastHandNote || state.log[state.log.length - 1] || ''),
  }
}

/** Compact pipe for BOARD chunks. Prefix `P1~` distinguishes Phase It. */
export function encodePhaseItPublicBoard(board: PhaseItPublicBoard): string {
  if (!board.live) return 'P1~0~'
  const playTo = board.playTo == null ? '-' : String(board.playTo)
  const turn = board.currentSeat < 0 ? '-' : String(board.currentSeat)
  const head = [
    'P1',
    '1',
    variantWire(board.variant),
    String(board.playerCount),
    String(board.round),
    playTo,
    phaseCode(board.phase),
    turn,
    board.topDiscard ? encodePhaseItFace(board.topDiscard) : '-',
    String(board.stockCount),
    clipMsg(board.lastMessage),
  ].join('~')
  const players = board.players
    .map(
      (p) =>
        `${clipName(p.name)}:${p.seat}:${p.handCount}:${p.score}:${p.phase}:${p.phaseDown ? 1 : 0}`,
    )
    .join(',')
  return `${head}^${players}`
}

export function isPhaseItBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('P1~')
}

export function decodePhaseItPublicBoard(raw: string): PhaseItPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('P1~')) return idlePhaseItPublicBoard()
  const [headPart, playersPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0') return idlePhaseItPublicBoard()
  if (head.length < 10) return idlePhaseItPublicBoard()

  const playRaw = head[5]!
  const turnRaw = head[7]!

  const players: PhaseItPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const parts = tok.split(':')
      if (parts.length < 5) return null
      const seat = Number(parts[1])
      if (!Number.isFinite(seat) || seat < 0 || seat > 3) return null
      const phaseNum = Number(parts[4])
      return {
        name: clipName(parts[0] || `P${seat + 1}`),
        seat,
        handCount: Number(parts[2]) || 0,
        score: Number(parts[3]) || 0,
        phase: Number.isFinite(phaseNum) ? phaseNum : 0,
        phaseDown: parts[5] === '1',
      }
    })
    .filter((p): p is PhaseItPublicPlayer => Boolean(p))

  return {
    live: true,
    variant: parseVariantWire(head[2] || 'c'),
    playerCount: Number(head[3]) || players.length || 4,
    round: Number(head[4]) || 1,
    playTo: playRaw === '-' ? null : Number(playRaw),
    phase: parsePhase(head[6] || 'i'),
    currentSeat: turnRaw === '-' ? -1 : Number(turnRaw),
    topDiscard: head[8] && head[8] !== '-' ? parsePhaseItFace(head[8]) : null,
    stockCount: Number(head[9]) || 0,
    players,
    lastMessage: clipMsg(head[10] || ''),
  }
}

export { phaseItVariantLabel, phaseLabel }

export function phaseItSpectatorStatus(board: PhaseItPublicBoard): string {
  if (!board.live) return 'Phase It parlor open — waiting for a deal'
  const who = (() => {
    const p = board.players.find((x) => x.seat === board.currentSeat)
    if (p?.name) return `${p.name} (Player ${board.currentSeat + 1})`
    if (board.currentSeat >= 0) return `Player ${board.currentSeat + 1}`
    return 'Someone'
  })()
  if (board.phase === 'play') return `${who}'s turn`
  if (board.phase === 'roundEnd') return 'Hand over — scoring'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || 'Phase It'
}
