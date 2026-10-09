import type { Card, Rank, Suit } from '../cards'
import { orderMeldCards } from './melds'
import type { RummyPhase, RummyState, RummyVariant } from './types'

export type RummyPublicMeld = {
  seat: number
  kind: 'set' | 'run'
  cards: Card[]
}

export type RummyPublicPlayer = {
  name: string
  seat: number
  handCount: number
  score: number
}

export type RummyPublicBoard = {
  live: boolean
  variant: RummyVariant
  round: number
  playTo: number | null
  handsPerMatch: number | null
  phase: RummyPhase | 'idle'
  currentSeat: number
  stock: number
  discardCount: number
  top: { rank: Rank; suit: Suit } | null
  players: RummyPublicPlayer[]
  melds: RummyPublicMeld[]
  lastMessage: string
  knockMax: number | null
  scoreMult: number
}

function clipName(raw: string): string {
  const s = raw.replace(/[|,:^~&?#]/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length <= 16 ? s : s.slice(0, 16)
}

function clipMsg(raw: string): string {
  const s = raw.replace(/[|&?#]/g, '/').replace(/~/g, '-').trim()
  return s.length <= 72 ? s : s.slice(0, 72)
}

function variantCode(v: RummyVariant): string {
  if (v === 'gin') return 'g'
  if (v === 'oklahoma') return 'o'
  if (v === 'rummy500') return 'f'
  if (v === 'kalooki') return 'k'
  return 's'
}

function parseVariant(ch: string): RummyVariant {
  if (ch === 'g') return 'gin'
  if (ch === 'o') return 'oklahoma'
  if (ch === 'f') return 'rummy500'
  if (ch === 'k') return 'kalooki'
  return 'standard'
}

function phaseCode(p: RummyPhase | 'idle'): string {
  if (p === 'draw') return 'd'
  if (p === 'meld') return 'm'
  if (p === 'discard') return 'x'
  if (p === 'roundEnd') return 'e'
  if (p === 'matchEnd') return 'g'
  return 'i'
}

function parsePhase(ch: string): RummyPhase | 'idle' {
  if (ch === 'd') return 'draw'
  if (ch === 'm') return 'meld'
  if (ch === 'x') return 'discard'
  if (ch === 'e') return 'roundEnd'
  if (ch === 'g') return 'matchEnd'
  return 'idle'
}

function encodeCardFace(card: Card): string {
  const r = card.rank === '10' ? 'T' : card.rank === 'JOKER' ? 'R' : card.rank
  return `${r}${card.suit}`
}

function parseCardFaces(raw: string): Card[] {
  const out: Card[] = []
  let i = 0
  let n = 0
  while (i < raw.length) {
    let rank: Rank | null = null
    const ch = raw[i]!
    if (ch === 'T') {
      rank = '10'
      i += 1
    } else if (ch === 'R') {
      rank = 'JOKER'
      i += 1
    } else if ('A23456789JQK'.includes(ch)) {
      rank = ch as Rank
      i += 1
    } else {
      return out
    }
    const suit = raw[i] as Suit | undefined
    i += 1
    if (!suit || !'HDSCJ'.includes(suit) || !rank) return out
    out.push({ id: `rpub-${n++}`, rank, suit })
  }
  return out
}

export function idleRummyPublicBoard(): RummyPublicBoard {
  return {
    live: false,
    variant: 'standard',
    round: 0,
    playTo: null,
    handsPerMatch: null,
    phase: 'idle',
    currentSeat: -1,
    stock: 0,
    discardCount: 0,
    top: null,
    players: [],
    melds: [],
    lastMessage: '',
    knockMax: null,
    scoreMult: 1,
  }
}

export function rummyPublicBoardFromState(state: RummyState): RummyPublicBoard {
  const top = state.discard[state.discard.length - 1]
  const cur = state.players[state.current]
  const turnSeat =
    state.phase === 'roundEnd' || state.phase === 'matchEnd' || !cur ? -1 : cur.seat
  const melds: RummyPublicMeld[] = []
  for (const pl of state.players) {
    for (const m of pl.melds) {
      melds.push({
        seat: pl.seat,
        kind: m.kind,
        cards: orderMeldCards(m.kind, m.cards),
      })
    }
  }
  const note =
    state.lastHandNote ||
    state.log[state.log.length - 1] ||
    ''
  return {
    live: state.phase !== 'matchEnd',
    variant: state.config.variant,
    round: state.round,
    playTo: state.config.playTo,
    handsPerMatch: state.config.handsPerMatch ?? null,
    phase: state.phase,
    currentSeat: turnSeat,
    stock: state.stock.length,
    discardCount: state.discard.length,
    top: top ? { rank: top.rank, suit: top.suit } : null,
    players: state.players.map((p) => ({
      name: clipName(p.name),
      seat: p.seat,
      handCount: p.hand.length,
      score: p.score,
    })),
    melds,
    lastMessage: clipMsg(note),
    knockMax: state.config.knockMax ?? null,
    scoreMult: state.scoreMultThisHand || 1,
  }
}

/** Compact pipe for BOARD chunks. Prefix `R1~` distinguishes from Canasta `1~`. */
export function encodeRummyPublicBoard(board: RummyPublicBoard): string {
  if (!board.live) return 'R1~0~'
  const playTo = board.playTo == null ? '-' : String(board.playTo)
  const hands = board.handsPerMatch == null ? '-' : String(board.handsPerMatch)
  const turn = board.currentSeat < 0 ? '-' : String(board.currentSeat)
  const top = board.top ? encodeCardFace({ id: '', rank: board.top.rank, suit: board.top.suit }) : '--'
  const knock = board.knockMax == null ? '-' : String(board.knockMax)
  const head = [
    'R1',
    '1',
    variantCode(board.variant),
    String(board.round),
    playTo,
    hands,
    phaseCode(board.phase),
    turn,
    String(board.stock),
    String(board.discardCount),
    top,
    knock,
    String(board.scoreMult),
    clipMsg(board.lastMessage),
  ].join('~')
  const players = board.players
    .map((p) => `${clipName(p.name)}:${p.seat}:${p.handCount}:${p.score}`)
    .join(',')
  const melds = board.melds
    .map((m) => {
      const kind = m.kind === 'run' ? 'r' : 's'
      const faces = orderMeldCards(m.kind, m.cards).map(encodeCardFace).join('')
      return `${m.seat}:${kind}:${faces}`
    })
    .join(',')
  return `${head}^${players}^${melds}`
}

export function isRummyBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('R1~')
}

export function decodeRummyPublicBoard(raw: string): RummyPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('R1~')) return idleRummyPublicBoard()
  const [headPart, playersPart = '', meldsPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0') return idleRummyPublicBoard()
  if (head.length < 12) return idleRummyPublicBoard()

  const playRaw = head[4]!
  const handsRaw = head[5]!
  const turnRaw = head[7]!
  const topRaw = head[10]!
  const knockRaw = head[11]!
  let top: RummyPublicBoard['top'] = null
  if (topRaw && topRaw !== '--') {
    const cards = parseCardFaces(topRaw)
    if (cards[0]) top = { rank: cards[0].rank, suit: cards[0].suit }
  }

  const players: RummyPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const parts = tok.split(':')
      if (parts.length < 4) return null
      const seat = Number(parts[1])
      const handCount = Number(parts[2])
      const score = Number(parts[3])
      if (!Number.isFinite(seat) || seat < 0 || seat > 3) return null
      return {
        name: clipName(parts[0] || `P${seat + 1}`),
        seat,
        handCount: Number.isFinite(handCount) ? handCount : 0,
        score: Number.isFinite(score) ? score : 0,
      }
    })
    .filter((p): p is RummyPublicPlayer => Boolean(p))

  const melds: RummyPublicMeld[] = (meldsPart || '')
    .split(',')
    .map((tok) => {
      const parts = tok.split(':')
      if (parts.length < 3) return null
      const seat = Number(parts[0])
      const kind = parts[1] === 'r' ? 'run' : parts[1] === 's' ? 'set' : null
      if (!Number.isFinite(seat) || !kind) return null
      const cards = parseCardFaces(parts.slice(2).join(':'))
      if (cards.length < 3) return null
      return { seat, kind, cards: orderMeldCards(kind, cards) }
    })
    .filter((m): m is RummyPublicMeld => Boolean(m))

  return {
    live: true,
    variant: parseVariant(head[2] || 's'),
    round: Number(head[3]) || 1,
    playTo: playRaw === '-' ? null : Number(playRaw),
    handsPerMatch: handsRaw === '-' ? null : Number(handsRaw),
    phase: parsePhase(head[6] || 'i'),
    currentSeat: turnRaw === '-' ? -1 : Number(turnRaw),
    stock: Number(head[8]) || 0,
    discardCount: Number(head[9]) || 0,
    top,
    players,
    melds,
    lastMessage: clipMsg(head[13] || ''),
    knockMax: knockRaw === '-' ? null : Number(knockRaw),
    scoreMult: Number(head[12]) || 1,
  }
}

export function rummyVariantLabel(v: RummyVariant): string {
  if (v === 'gin') return 'Gin'
  if (v === 'oklahoma') return 'Oklahoma'
  if (v === 'rummy500') return 'Rummy 500'
  if (v === 'kalooki') return 'Kalooki'
  return 'Standard'
}
