import type { Card, Rank, Suit } from '../cards'
import type { PassDirection, TrickPhase, TrickState, TrickVariant } from './types'
import { passDirectionLabel } from './variants'

export type TrickPublicPlayer = {
  name: string
  seat: number
  handCount: number
  score: number
  takenThisHand: number
  tricksTaken: number
}

export type TrickPublicPlay = {
  seat: number
  card: Card
}

export type TrickPublicBoard = {
  live: boolean
  variant: TrickVariant
  playerCount: number
  round: number
  playTo: number | null
  phase: TrickPhase | 'idle'
  currentSeat: number
  heartsBroken: boolean
  passDirection: PassDirection
  players: TrickPublicPlayer[]
  /** Face-up cards in the current trick (play order). */
  trick: TrickPublicPlay[]
  lastMessage: string
  lastTrickNote: string
}

function clipName(raw: string): string {
  const s = raw.replace(/[|,:^~&?#]/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length <= 16 ? s : s.slice(0, 16)
}

function clipMsg(raw: string): string {
  const s = raw.replace(/[|&?#]/g, '/').replace(/~/g, '-').trim()
  return s.length <= 72 ? s : s.slice(0, 72)
}

function variantCode(v: TrickVariant): string {
  if (v === 'rooster') return 'r'
  if (v === 'spades') return 's'
  if (v === 'euchre') return 'u'
  if (v === 'ohhell') return 'o'
  return 'h'
}

function parseVariant(ch: string): TrickVariant {
  if (ch === 'r') return 'rooster'
  if (ch === 's') return 'spades'
  if (ch === 'u') return 'euchre'
  if (ch === 'o') return 'ohhell'
  return 'hearts'
}

function phaseCode(p: TrickPhase | 'idle'): string {
  if (p === 'pass') return 'p'
  if (p === 'bid') return 'b'
  if (p === 'nest') return 'n'
  if (p === 'trump') return 't'
  if (p === 'play') return 'y'
  if (p === 'roundEnd') return 'e'
  if (p === 'matchEnd') return 'g'
  return 'i'
}

function parsePhase(ch: string): TrickPhase | 'idle' {
  if (ch === 'p') return 'pass'
  if (ch === 'b') return 'bid'
  if (ch === 'n') return 'nest'
  if (ch === 't') return 'trump'
  if (ch === 'y') return 'play'
  if (ch === 'e') return 'roundEnd'
  if (ch === 'g') return 'matchEnd'
  return 'idle'
}

function passCode(d: PassDirection): string {
  if (d === 'left') return 'l'
  if (d === 'right') return 'r'
  if (d === 'across') return 'a'
  return 'h'
}

function parsePass(ch: string): PassDirection {
  if (ch === 'l') return 'left'
  if (ch === 'r') return 'right'
  if (ch === 'a') return 'across'
  return 'hold'
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
    out.push({ id: `tpub-${n++}`, rank, suit })
  }
  return out
}

export function idleTrickPublicBoard(): TrickPublicBoard {
  return {
    live: false,
    variant: 'hearts',
    playerCount: 4,
    round: 0,
    playTo: null,
    phase: 'idle',
    currentSeat: -1,
    heartsBroken: false,
    passDirection: 'left',
    players: [],
    trick: [],
    lastMessage: '',
    lastTrickNote: '',
  }
}

export function trickPublicBoardFromState(state: TrickState): TrickPublicBoard {
  const cur = state.players[state.current]
  const turnSeat =
    state.phase === 'roundEnd' || state.phase === 'matchEnd' || !cur ? -1 : cur.seat
  const note =
    state.lastHandNote ||
    state.lastTrickNote ||
    state.log[state.log.length - 1] ||
    ''
  return {
    live: state.phase !== 'matchEnd',
    variant: state.config.variant,
    playerCount: state.config.playerCount,
    round: state.round,
    playTo: state.config.playTo,
    phase: state.phase,
    currentSeat: turnSeat,
    heartsBroken: state.heartsBroken,
    passDirection: state.passDirection,
    players: state.players.map((p, i) => ({
      name: clipName(p.name),
      seat: p.seat,
      handCount: p.hand.length,
      score: p.score,
      takenThisHand: p.takenThisHand,
      tricksTaken: state.tricksTaken[i] ?? 0,
    })),
    trick: state.trick.map((t, i) => ({
      seat: t.seat,
      card: { ...t.card, id: t.card.id || `trick-${i}` },
    })),
    lastMessage: clipMsg(note),
    lastTrickNote: clipMsg(state.lastTrickNote || ''),
  }
}

/** Compact pipe for BOARD chunks. Prefix `T1~` distinguishes from Canasta / Rummy. */
export function encodeTrickPublicBoard(board: TrickPublicBoard): string {
  if (!board.live) return 'T1~0~'
  const playTo = board.playTo == null ? '-' : String(board.playTo)
  const turn = board.currentSeat < 0 ? '-' : String(board.currentSeat)
  const head = [
    'T1',
    '1',
    variantCode(board.variant),
    String(board.playerCount),
    String(board.round),
    playTo,
    phaseCode(board.phase),
    turn,
    board.heartsBroken ? '1' : '0',
    passCode(board.passDirection),
    clipMsg(board.lastMessage),
    clipMsg(board.lastTrickNote),
  ].join('~')
  const players = board.players
    .map(
      (p) =>
        `${clipName(p.name)}:${p.seat}:${p.handCount}:${p.score}:${p.takenThisHand}:${p.tricksTaken}`,
    )
    .join(',')
  const trick = board.trick.map((t) => `${t.seat}:${encodeCardFace(t.card)}`).join(',')
  return `${head}^${players}^${trick}`
}

export function isTrickBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('T1~')
}

export function decodeTrickPublicBoard(raw: string): TrickPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('T1~')) return idleTrickPublicBoard()
  const [headPart, playersPart = '', trickPart = ''] = text.split('^')
  const head = headPart.split('~')
  if (head[1] === '0') return idleTrickPublicBoard()
  if (head.length < 10) return idleTrickPublicBoard()

  const playRaw = head[5]!
  const turnRaw = head[7]!

  const players: TrickPublicPlayer[] = (playersPart || '')
    .split(',')
    .map((tok) => {
      const parts = tok.split(':')
      if (parts.length < 6) return null
      const seat = Number(parts[1])
      if (!Number.isFinite(seat) || seat < 0 || seat > 3) return null
      return {
        name: clipName(parts[0] || `P${seat + 1}`),
        seat,
        handCount: Number(parts[2]) || 0,
        score: Number(parts[3]) || 0,
        takenThisHand: Number(parts[4]) || 0,
        tricksTaken: Number(parts[5]) || 0,
      }
    })
    .filter((p): p is TrickPublicPlayer => Boolean(p))

  const trick: TrickPublicPlay[] = (trickPart || '')
    .split(',')
    .map((tok, i) => {
      const colon = tok.indexOf(':')
      if (colon < 0) return null
      const seat = Number(tok.slice(0, colon))
      const faces = parseCardFaces(tok.slice(colon + 1))
      if (!Number.isFinite(seat) || seat < 0 || seat > 3 || !faces[0]) return null
      return { seat, card: { ...faces[0], id: faces[0].id || `tpub-trick-${i}` } }
    })
    .filter((t): t is TrickPublicPlay => Boolean(t))

  return {
    live: true,
    variant: parseVariant(head[2] || 'h'),
    playerCount: Number(head[3]) || players.length || 4,
    round: Number(head[4]) || 1,
    playTo: playRaw === '-' ? null : Number(playRaw),
    phase: parsePhase(head[6] || 'i'),
    currentSeat: turnRaw === '-' ? -1 : Number(turnRaw),
    heartsBroken: head[8] === '1',
    passDirection: parsePass(head[9] || 'l'),
    players,
    trick,
    lastMessage: clipMsg(head[10] || ''),
    lastTrickNote: clipMsg(head[11] || ''),
  }
}

export function trickVariantLabel(v: TrickVariant): string {
  if (v === 'rooster') return 'Rooster'
  if (v === 'spades') return 'Spades'
  if (v === 'euchre') return 'Euchre'
  if (v === 'ohhell') return 'Oh Hell'
  return 'Hearts'
}

export function trickSpectatorStatus(board: TrickPublicBoard): string {
  if (!board.live) return 'Trick parlor open — waiting for a deal'
  const who = (() => {
    const p = board.players.find((x) => x.seat === board.currentSeat)
    if (p?.name) return `${p.name} (Player ${board.currentSeat + 1})`
    if (board.currentSeat >= 0) return `Player ${board.currentSeat + 1}`
    return 'Someone'
  })()
  if (board.phase === 'pass') {
    return `${who} is passing ${passDirectionLabel(board.passDirection)}…`
  }
  if (board.phase === 'bid') return `${who} is bidding…`
  if (board.phase === 'nest') return `${who} is burying the nest…`
  if (board.phase === 'trump') return `${who} is naming trump…`
  if (board.phase === 'play') {
    if (board.trick.length === 0) return `${who} leads`
    return `${who} is playing · trick ${board.trick.length}/${board.playerCount}`
  }
  if (board.phase === 'roundEnd') return 'Hand over — scoring'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || 'Hearts'
}
