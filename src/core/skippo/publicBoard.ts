import { encodeSkippoFace, parseSkippoFace } from './deck'
import type { SkippoCard, SkippoPhase, SkippoState, SkippoVariant } from './types'
import { skippoVariantLabel } from './variants'
import { stockTop } from './state'

export type SkippoPublicPlayer = {
  name: string
  seat: number
  stockCount: number
  stockTop: SkippoCard | null
  handCount: number
  score: number
}

export type SkippoPublicBoard = {
  live: boolean
  variant: SkippoVariant
  playerCount: number
  round: number
  playTo: number | null
  phase: SkippoPhase | 'idle'
  currentSeat: number
  builders: (SkippoCard | null)[]
  builderNext: number[]
  drawCount: number
  players: SkippoPublicPlayer[]
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

function phaseCode(p: SkippoPhase | 'idle'): string {
  if (p === 'play') return 'y'
  if (p === 'roundEnd') return 'e'
  if (p === 'matchEnd') return 'g'
  return 'i'
}

function parsePhase(ch: string): SkippoPhase | 'idle' {
  if (ch === 'y') return 'play'
  if (ch === 'e') return 'roundEnd'
  if (ch === 'g') return 'matchEnd'
  return 'idle'
}

export function idleSkippoPublicBoard(): SkippoPublicBoard {
  return {
    live: false,
    variant: 'classic',
    playerCount: 4,
    round: 0,
    playTo: null,
    phase: 'idle',
    currentSeat: -1,
    builders: [null, null, null, null],
    builderNext: [1, 1, 1, 1],
    drawCount: 0,
    players: [],
    lastMessage: '',
  }
}

export function skippoPublicBoardFromState(state: SkippoState): SkippoPublicBoard {
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
    builders: state.builders.map((b) =>
      b.cards.length ? b.cards[b.cards.length - 1]! : null,
    ),
    builderNext: state.builders.map((b) => b.next),
    drawCount: state.draw.length,
    players: state.players.map((p) => ({
      name: clipName(p.name),
      seat: p.seat,
      stockCount: p.stock.length,
      stockTop: stockTop(p),
      handCount: p.hand.length,
      score: p.score,
    })),
    lastMessage: clipMsg(state.lastMessage || state.lastHandNote || state.log[state.log.length - 1] || ''),
  }
}

/** Compact pipe for BOARD chunks. Prefix `K1~` distinguishes Skippo. */
export function encodeSkippoPublicBoard(board: SkippoPublicBoard): string {
  if (!board.live) return 'K1~0~'
  const playTo = board.playTo == null ? '-' : String(board.playTo)
  const turn = board.currentSeat < 0 ? '-' : String(board.currentSeat)
  const tops = board.builders.map((c) => (c ? encodeSkippoFace(c) : '-')).join(',')
  const nexts = board.builderNext.join(',')
  const head = [
    'K1',
    '1',
    'c',
    String(board.playerCount),
    String(board.round),
    playTo,
    phaseCode(board.phase),
    turn,
    tops,
    nexts,
    String(board.drawCount),
    clipMsg(board.lastMessage),
  ].join('~')
  const players = board.players
    .map(
      (p) =>
        `${clipName(p.name)}:${p.seat}:${p.stockCount}:${p.handCount}:${p.score}:${p.stockTop ? encodeSkippoFace(p.stockTop) : '-'}`,
    )
    .join(',')
  return `${head}^${players}`
}

export function isSkippoBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('K1~')
}

export function decodeSkippoPublicBoard(raw: string): SkippoPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('K1~')) return idleSkippoPublicBoard()
  const [headPart, playersPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0') return idleSkippoPublicBoard()
  if (head.length < 11) return idleSkippoPublicBoard()

  const playRaw = head[5]!
  const turnRaw = head[7]!
  const tops = (head[8] || '').split(',')
  const nexts = (head[9] || '').split(',').map((x) => Number(x) || 1)

  const players: SkippoPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const parts = tok.split(':')
      if (parts.length < 5) return null
      const seat = Number(parts[1])
      if (!Number.isFinite(seat) || seat < 0 || seat > 3) return null
      return {
        name: clipName(parts[0] || `P${seat + 1}`),
        seat,
        stockCount: Number(parts[2]) || 0,
        handCount: Number(parts[3]) || 0,
        score: Number(parts[4]) || 0,
        stockTop: parts[5] && parts[5] !== '-' ? parseSkippoFace(parts[5]) : null,
      }
    })
    .filter((p): p is SkippoPublicPlayer => Boolean(p))

  return {
    live: true,
    variant: 'classic',
    playerCount: Number(head[3]) || players.length || 4,
    round: Number(head[4]) || 1,
    playTo: playRaw === '-' ? null : Number(playRaw),
    phase: parsePhase(head[6] || 'i'),
    currentSeat: turnRaw === '-' ? -1 : Number(turnRaw),
    builders: [0, 1, 2, 3].map((i) =>
      tops[i] && tops[i] !== '-' ? parseSkippoFace(tops[i]!) : null,
    ),
    builderNext: [0, 1, 2, 3].map((i) => nexts[i] ?? 1),
    drawCount: Number(head[10]) || 0,
    players,
    lastMessage: clipMsg(head[11] || ''),
  }
}

export { skippoVariantLabel }

export function skippoSpectatorStatus(board: SkippoPublicBoard): string {
  if (!board.live) return 'Skippo parlor open — waiting for a deal'
  const who = (() => {
    const p = board.players.find((x) => x.seat === board.currentSeat)
    if (p?.name) return `${p.name} (Player ${board.currentSeat + 1})`
    if (board.currentSeat >= 0) return `Player ${board.currentSeat + 1}`
    return 'Someone'
  })()
  if (board.phase === 'play') return `${who}'s turn`
  if (board.phase === 'roundEnd') return 'Hand over — scoring'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || 'Skippo'
}
