import { encodeIchiFace, parseIchiFace } from './deck'
import type { IchiCard, IchiColor, IchiPhase, IchiState, IchiVariant } from './types'
import { ichiVariantLabel } from './variants'

export type IchiPublicPlayer = {
  name: string
  seat: number
  handCount: number
  score: number
}

export type IchiPublicBoard = {
  live: boolean
  variant: IchiVariant
  playerCount: number
  round: number
  playTo: number | null
  phase: IchiPhase | 'idle'
  currentSeat: number
  direction: 1 | -1
  currentColor: IchiColor
  topDiscard: IchiCard | null
  stockCount: number
  players: IchiPublicPlayer[]
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

function phaseCode(p: IchiPhase | 'idle'): string {
  if (p === 'play') return 'y'
  if (p === 'colorPick') return 'c'
  if (p === 'challenge') return 'h'
  if (p === 'roundEnd') return 'e'
  if (p === 'matchEnd') return 'g'
  return 'i'
}

function parsePhase(ch: string): IchiPhase | 'idle' {
  if (ch === 'y') return 'play'
  if (ch === 'c') return 'colorPick'
  if (ch === 'h') return 'challenge'
  if (ch === 'e') return 'roundEnd'
  if (ch === 'g') return 'matchEnd'
  return 'idle'
}

export function idleIchiPublicBoard(): IchiPublicBoard {
  return {
    live: false,
    variant: 'classic',
    playerCount: 4,
    round: 0,
    playTo: null,
    phase: 'idle',
    currentSeat: -1,
    direction: 1,
    currentColor: 'R',
    topDiscard: null,
    stockCount: 0,
    players: [],
    lastMessage: '',
  }
}

export function ichiPublicBoardFromState(state: IchiState): IchiPublicBoard {
  const cur = state.players[state.current]
  const turnSeat =
    state.phase === 'roundEnd' || state.phase === 'matchEnd' || !cur ? -1 : cur.seat
  const top = state.discard[state.discard.length - 1] ?? null
  return {
    live: state.phase !== 'matchEnd',
    variant: state.config.variant,
    playerCount: state.config.playerCount,
    round: state.round,
    playTo: state.config.playTo,
    phase: state.phase,
    currentSeat: turnSeat,
    direction: state.direction,
    currentColor: state.currentColor,
    topDiscard: top,
    stockCount: state.stock.length,
    players: state.players.map((p) => ({
      name: clipName(p.name),
      seat: p.seat,
      handCount: p.hand.length,
      score: p.score,
    })),
    lastMessage: clipMsg(state.lastMessage || state.lastHandNote || state.log[state.log.length - 1] || ''),
  }
}

/** Compact pipe for BOARD chunks. Prefix `I1~` distinguishes from Canasta / Rummy / Trick. */
export function encodeIchiPublicBoard(board: IchiPublicBoard): string {
  if (!board.live) return 'I1~0~'
  const playTo = board.playTo == null ? '-' : String(board.playTo)
  const turn = board.currentSeat < 0 ? '-' : String(board.currentSeat)
  const top = board.topDiscard ? encodeIchiFace(board.topDiscard) : '-'
  const head = [
    'I1',
    '1',
    'c', // classic
    String(board.playerCount),
    String(board.round),
    playTo,
    phaseCode(board.phase),
    turn,
    board.direction === 1 ? '+' : '-',
    board.currentColor,
    top,
    String(board.stockCount),
    clipMsg(board.lastMessage),
  ].join('~')
  const players = board.players
    .map((p) => `${clipName(p.name)}:${p.seat}:${p.handCount}:${p.score}`)
    .join(',')
  return `${head}^${players}`
}

export function isIchiBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('I1~')
}

export function decodeIchiPublicBoard(raw: string): IchiPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('I1~')) return idleIchiPublicBoard()
  const [headPart, playersPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0') return idleIchiPublicBoard()
  if (head.length < 12) return idleIchiPublicBoard()

  const playRaw = head[5]!
  const turnRaw = head[7]!
  const topRaw = head[10]!

  const players: IchiPublicPlayer[] = (playersPart || '')
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
        score: Number(parts[3]) || 0,
      }
    })
    .filter((p): p is IchiPublicPlayer => Boolean(p))

  return {
    live: true,
    variant: 'classic',
    playerCount: Number(head[3]) || players.length || 4,
    round: Number(head[4]) || 1,
    playTo: playRaw === '-' ? null : Number(playRaw),
    phase: parsePhase(head[6] || 'i'),
    currentSeat: turnRaw === '-' ? -1 : Number(turnRaw),
    direction: head[8] === '-' ? -1 : 1,
    currentColor: (['R', 'Y', 'G', 'B'].includes(head[9] || '') ? head[9] : 'R') as IchiColor,
    topDiscard: topRaw === '-' ? null : parseIchiFace(topRaw),
    stockCount: Number(head[11]) || 0,
    players,
    lastMessage: clipMsg(head[12] || ''),
  }
}

export { ichiVariantLabel }

export function ichiSpectatorStatus(board: IchiPublicBoard): string {
  if (!board.live) return 'Ichi parlor open — waiting for a deal'
  const who = (() => {
    const p = board.players.find((x) => x.seat === board.currentSeat)
    if (p?.name) return `${p.name} (Player ${board.currentSeat + 1})`
    if (board.currentSeat >= 0) return `Player ${board.currentSeat + 1}`
    return 'Someone'
  })()
  if (board.phase === 'colorPick') return `${who} is naming a color…`
  if (board.phase === 'challenge') return `${who} may challenge +4…`
  if (board.phase === 'play') return `${who}'s turn · color ${board.currentColor}`
  if (board.phase === 'roundEnd') return 'Hand over — scoring'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || 'Ichi'
}
