import { makeCard, type Card, type MeldRank, type Rank, type Suit } from './cards'
import { canastaKind } from './melds'
import type { Meld, MatchState, Phase, Variant } from './types'
import { variantConfig } from './variants'

export type PublicMeldKind = 'open' | 'clean' | 'dirty' | 'wild'

export type PublicMeld = {
  rank: MeldRank
  count: number
  kind: PublicMeldKind
  /** Rank letters in play order, e.g. JJJ2* — 2 = deuce, * = joker. */
  faces?: string
}

export type PublicPlayer = {
  name: string
  seat: number
  team: 0 | 1
  handCount: number
  /** 0 = foot sealed, 1 = foot open, -1 = no foot (Classic Canasta). */
  foot: 0 | 1 | -1
}

export type PublicTeam = {
  score: number
  hasMeld: boolean
  redThrees: number
  melds: PublicMeld[]
}

export type PublicPhase = Phase | 'idle'

export type PublicBoard = {
  live: boolean
  variant: Variant
  round: number
  playTo: number | null
  phase: PublicPhase
  currentSeat: number
  stock: number
  discardCount: number
  frozen: boolean
  top: { rank: Rank; suit: Suit } | null
  players: PublicPlayer[]
  teams: [PublicTeam, PublicTeam]
  lastMessage: string
}

const SUITS_CYCLE: Suit[] = ['H', 'D', 'S', 'C']

function clipName(raw: string): string {
  const s = raw.replace(/[|,:^~&?#]/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length <= 16 ? s : s.slice(0, 16)
}

function clipMsg(raw: string): string {
  const s = raw.replace(/[|&?#]/g, '/').replace(/~/g, '-').trim()
  return s.length <= 72 ? s : s.slice(0, 72)
}

function rankChar(rank: string): string {
  if (rank === '10') return 'T'
  if (rank === 'JOKER') return 'R'
  if (rank === 'WILD') return 'W'
  return rank
}

function parseRankChar(ch: string): string | null {
  if (ch === 'T') return '10'
  if (ch === 'R' || ch === '*') return 'JOKER'
  if (ch === 'W') return 'WILD'
  if ('23456789JQKA'.includes(ch)) return ch
  return null
}

function faceChar(rank: string): string {
  if (rank === 'JOKER') return '*'
  if (rank === 'WILD') return '2'
  if (rank === '10') return 'T'
  return rank
}

export function meldFacesFromCards(cards: Card[]): string {
  return cards.map((c) => faceChar(c.rank)).join('')
}

function kindChar(kind: PublicMeldKind): string {
  if (kind === 'clean') return 'c'
  if (kind === 'dirty') return 'd'
  if (kind === 'wild') return 'w'
  return 'o'
}

function parseKindChar(ch: string): PublicMeldKind | null {
  if (ch === 'c') return 'clean'
  if (ch === 'd') return 'dirty'
  if (ch === 'w') return 'wild'
  if (ch === 'o') return 'open'
  return null
}

function meldKind(meld: Meld, size: number): PublicMeldKind {
  const k = canastaKind(meld, size)
  if (k === 'natural') return 'clean'
  if (k === 'mixed') return 'dirty'
  if (k === 'wild') return 'wild'
  return 'open'
}

function phaseChar(phase: PublicPhase): string {
  if (phase === 'awaitingDraw') return 'd'
  if (phase === 'awaitingPlay') return 'p'
  if (phase === 'awaitingGoOutConsent') return 'g'
  if (phase === 'roundEnd') return 'r'
  if (phase === 'matchEnd') return 'm'
  return 'i'
}

function parsePhase(ch: string): PublicPhase {
  if (ch === 'd') return 'awaitingDraw'
  if (ch === 'p') return 'awaitingPlay'
  if (ch === 'g') return 'awaitingGoOutConsent'
  if (ch === 'r') return 'roundEnd'
  if (ch === 'm') return 'matchEnd'
  return 'idle'
}

function emptyTeam(): PublicTeam {
  return { score: 0, hasMeld: false, redThrees: 0, melds: [] }
}

export function idlePublicBoard(): PublicBoard {
  return {
    live: false,
    variant: 'canasta',
    round: 1,
    playTo: 5000,
    phase: 'idle',
    currentSeat: -1,
    stock: 0,
    discardCount: 0,
    frozen: false,
    top: null,
    players: [],
    teams: [emptyTeam(), emptyTeam()],
    lastMessage: '',
  }
}

export function publicBoardFromMatch(state: MatchState): PublicBoard {
  const size = state.config.canastaSize
  const players: PublicPlayer[] = state.players.map((p) => ({
    name: clipName(p.displayName),
    seat: p.seat,
    team: p.team,
    handCount: p.hand.length,
    foot: state.config.footSize <= 0 ? -1 : p.footPickedUp ? 1 : 0,
  }))
  const teams = state.teams.map((t) => ({
    score: t.score,
    hasMeld: t.hasInitialMeld,
    redThrees: t.redThrees.length,
    melds: t.melds.map((m) => ({
      rank: m.rank,
      count: m.cards.length,
      kind: meldKind(m, size),
      faces: meldFacesFromCards(m.cards),
    })),
  })) as [PublicTeam, PublicTeam]
  const top = state.discard[state.discard.length - 1] ?? null
  return {
    live: true,
    variant: state.config.variant,
    round: state.round,
    playTo: state.config.playTo,
    phase: state.phase,
    currentSeat: state.currentPlayer,
    stock: state.stock.length,
    discardCount: state.discard.length,
    frozen: state.discardFrozen,
    top: top ? { rank: top.rank, suit: top.suit } : null,
    players,
    teams,
    lastMessage: clipMsg(state.lastMessage),
  }
}

export function encodePublicBoard(board: PublicBoard): string {
  const live = board.live ? '1' : '0'
  const variant = board.variant === 'handAndFoot' ? 'h' : 'c'
  const playTo = board.playTo == null ? '-' : String(board.playTo)
  const turn = board.currentSeat < 0 ? '-' : String(board.currentSeat)
  const frozen = board.frozen ? '1' : '0'
  let top = '--'
  if (board.top) top = rankChar(board.top.rank) + board.top.suit
  const head = [
    '1',
    live,
    variant,
    String(board.round),
    playTo,
    phaseChar(board.phase),
    turn,
    String(board.stock),
    String(board.discardCount),
    frozen,
    top,
    clipMsg(board.lastMessage),
  ].join('~')
  const players = board.players
    .map((p) => `${clipName(p.name)}:${p.seat}:${p.handCount}:${p.foot}`)
    .join(',')
  const teams = board.teams
    .map((t) => {
      const has = t.hasMeld ? '1' : '0'
      const melds = t.melds
        .map((m) => `${rankChar(m.rank)}${kindChar(m.kind)}${m.faces || String(m.count)}`)
        .join(',')
      return `${t.score}:${has}:${t.redThrees}:${melds}`
    })
    .join(';')
  return `${head}^${players}^${teams}`
}

export function isIdleBoardPayload(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  return t.startsWith('1~0~') || t.startsWith('1|0|')
}

function normalizeFaces(raw: string): string | null {
  let faces = ''
  for (const ch of raw.toUpperCase()) {
    const rank = parseRankChar(ch === '*' ? '*' : ch)
    if (!rank) return null
    faces += faceChar(rank)
  }
  return faces.length ? faces : null
}

function parseMeldToken(tok: string): PublicMeld | null {
  if (tok.length < 3) return null
  const rank = parseRankChar(tok[0]!)
  const kind = parseKindChar(tok[1]!)
  if (!rank || !kind) return null
  const rest = tok.slice(2)
  if (!rest) return null
  const allDigits = /^\d+$/.test(rest)
  const n = Number(rest)
  if (allDigits && rest.length <= 2 && Number.isFinite(n) && n >= 1 && n <= 18) {
    return { rank: rank as MeldRank, count: n, kind }
  }
  const faces = normalizeFaces(rest)
  if (!faces) return null
  return { rank: rank as MeldRank, count: faces.length, kind, faces }
}

function parsePlayerToken(tok: string): PublicPlayer | null {
  const parts = tok.split(':')
  if (parts.length < 4) return null
  const seat = Number(parts[1])
  const handCount = Number(parts[2])
  const foot = Number(parts[3])
  if (!Number.isFinite(seat) || seat < 0 || seat > 3) return null
  if (!Number.isFinite(handCount) || handCount < 0) return null
  const footVal: 0 | 1 | -1 = foot === 1 ? 1 : foot === 0 ? 0 : -1
  return {
    name: clipName(parts[0] || `P${seat + 1}`),
    seat,
    team: (seat % 2 === 0 ? 0 : 1) as 0 | 1,
    handCount,
    foot: footVal,
  }
}

function parseTeamToken(tok: string): PublicTeam {
  const parts = tok.split(':')
  const score = Number(parts[0] || 0)
  const hasMeld = parts[1] === '1'
  const redThrees = Number(parts[2] || 0)
  const melds = (parts[3] || '')
    .split(',')
    .map((m) => parseMeldToken(m))
    .filter((m): m is PublicMeld => Boolean(m))
  return {
    score: Number.isFinite(score) ? score : 0,
    hasMeld,
    redThrees: Number.isFinite(redThrees) ? redThrees : 0,
    melds,
  }
}

export function decodePublicBoard(raw: string): PublicBoard {
  const text = raw.trim()
  if (!text) return idlePublicBoard()
  const lines = text.split('^')
  const rawHead = lines[0] || ''
  const head = rawHead.includes('~') ? rawHead.split('~') : rawHead.split('|')
  if (head[0] !== '1' || head.length < 11) return idlePublicBoard()
  const live = head[1] === '1'
  const variant: Variant = head[2] === 'h' ? 'handAndFoot' : 'canasta'
  const round = Number(head[3] || 1)
  const playTo = head[4] === '-' || head[4] === '' ? null : Number(head[4])
  const phase = parsePhase(head[5] || 'i')
  const turnRaw = head[6] || '-'
  const currentSeat = turnRaw === '-' ? -1 : Number(turnRaw)
  const stock = Number(head[7] || 0)
  const discardCount = Number(head[8] || 0)
  const frozen = head[9] === '1'
  const topTok = head[10] || '--'
  let top: PublicBoard['top'] = null
  if (topTok.length >= 2 && topTok !== '--') {
    const rank = parseRankChar(topTok[0]!)
    const suit = topTok[1] as Suit
    if (rank && rank !== 'WILD' && 'HDSCJ'.includes(suit)) {
      top = { rank: rank as Rank, suit }
    }
  }
  const lastMessage = clipMsg(head.slice(11).join('|'))
  const players = (lines[1] || '')
    .split(',')
    .map((p) => parsePlayerToken(p))
    .filter((p): p is PublicPlayer => Boolean(p))
  const teamParts = (lines[2] || '').split(';')
  const teams: [PublicTeam, PublicTeam] = [
    parseTeamToken(teamParts[0] || ''),
    parseTeamToken(teamParts[1] || ''),
  ]
  return {
    live,
    variant,
    round: Number.isFinite(round) ? round : 1,
    playTo: playTo != null && Number.isFinite(playTo) ? playTo : null,
    phase,
    currentSeat: Number.isFinite(currentSeat) ? currentSeat : -1,
    stock: Number.isFinite(stock) ? stock : 0,
    discardCount: Number.isFinite(discardCount) ? discardCount : 0,
    frozen,
    top,
    players,
    teams,
    lastMessage,
  }
}

function cardsFromFaces(faces: string): Card[] {
  const cards: Card[] = []
  let nats = 0
  let wilds = 0
  for (let i = 0; i < faces.length; i++) {
    const rank = parseRankChar(faces[i]!)
    if (!rank) continue
    if (rank === 'JOKER') {
      cards.push(makeCard(0, 'J', 'JOKER', i))
      wilds++
    } else if (rank === '2' || rank === 'WILD') {
      cards.push(makeCard(0, SUITS_CYCLE[wilds % 4]!, '2', i))
      wilds++
    } else {
      const r = rank as Rank
      const suit: Suit = r === '3' ? (nats % 2 === 0 ? 'S' : 'C') : SUITS_CYCLE[nats % 4]!
      cards.push(makeCard(0, suit, r, i))
      nats++
    }
  }
  return cards
}

/** Face-up cards for the spectator tray — ranks from the snapshot, never hole-card ids. */
export function publicMeldCards(meld: PublicMeld): Card[] {
  if (meld.faces) return cardsFromFaces(meld.faces)
  const cards: Card[] = []
  const n = Math.max(1, Math.min(meld.count, 18))
  if (meld.kind === 'wild' || meld.rank === 'WILD') {
    for (let i = 0; i < n; i++) {
      if (i % 3 === 2) cards.push(makeCard(0, 'J', 'JOKER', i))
      else cards.push(makeCard(0, 'H', '2', i))
    }
    return cards
  }
  const rank = meld.rank === '3' ? '3' : (meld.rank as Rank)
  let wilds = 0
  if (meld.kind === 'dirty') wilds = Math.max(1, n - 4)
  const naturals = Math.max(0, n - wilds)
  for (let i = 0; i < naturals; i++) {
    const suit: Suit = meld.rank === '3' ? (i % 2 === 0 ? 'S' : 'C') : SUITS_CYCLE[i % 4]!
    cards.push(makeCard(0, suit, rank, i))
  }
  for (let i = 0; i < wilds; i++) cards.push(makeCard(0, 'H', '2', 80 + i))
  return cards
}

export function publicMeldsAsEngine(melds: PublicMeld[]): Meld[] {
  return melds.map((m) => ({
    rank: m.rank,
    cards: publicMeldCards(m),
    closed: m.kind !== 'open',
  }))
}

export function spectatorConfig(board: PublicBoard) {
  return variantConfig(board.variant, Math.max(2, board.players.length || 4))
}
