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

/** Per physical seat: no card, face-down, or revealed kind. */
export type RowShamBoPublicPlay = null | 'down' | RowShamBoKind

export type RowShamBoPublicDuel = {
  stepIndex: number
  subphase: 'idle' | 'challengerDown' | 'result'
  outcome: 'tie' | 'contestedWin' | 'nextWin' | null
  /** Physical seats in the contested group. */
  contestedSeats: number[]
  /** Physical seat of the challenger (-1 if none). */
  nextSeat: number
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
  /** Table plays keyed by physical seat 0–3. */
  tablePlays: RowShamBoPublicPlay[]
  duel: RowShamBoPublicDuel | null
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

function kindWire(k: RowShamBoKind): string {
  if (k === 'rock') return 'R'
  if (k === 'paper') return 'P'
  if (k === 'scissors') return 'S'
  if (k === 'dynamite') return 'D'
  if (k === 'water') return 'W'
  if (k === 'earth') return 'E'
  return 'F'
}

function parseKindWire(ch: string): RowShamBoKind | null {
  if (ch === 'R') return 'rock'
  if (ch === 'P') return 'paper'
  if (ch === 'S') return 'scissors'
  if (ch === 'D') return 'dynamite'
  if (ch === 'W') return 'water'
  if (ch === 'E') return 'earth'
  if (ch === 'F') return 'fire'
  return null
}

function subphaseWire(s: RowShamBoPublicDuel['subphase']): string {
  if (s === 'challengerDown') return 'c'
  if (s === 'result') return 'r'
  return 'i'
}

function parseSubphase(ch: string): RowShamBoPublicDuel['subphase'] {
  if (ch === 'c') return 'challengerDown'
  if (ch === 'r') return 'result'
  return 'idle'
}

function outcomeWire(o: RowShamBoPublicDuel['outcome']): string {
  if (o === 'tie') return 't'
  if (o === 'contestedWin') return 'w'
  if (o === 'nextWin') return 'n'
  return '-'
}

function parseOutcome(ch: string): RowShamBoPublicDuel['outcome'] {
  if (ch === 't') return 'tie'
  if (ch === 'w') return 'contestedWin'
  if (ch === 'n') return 'nextWin'
  return null
}

function emptyPlays(): RowShamBoPublicPlay[] {
  return [null, null, null, null]
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
    tablePlays: emptyPlays(),
    duel: null,
    lastMessage: '',
  }
}

export function rowShamBoPublicBoardFromState(state: RowShamBoState): RowShamBoPublicBoard {
  const tablePlays = emptyPlays()
  for (let i = 0; i < state.players.length; i++) {
    const pl = state.players[i]!
    const seat = pl.seat
    if (seat < 0 || seat > 3) continue
    const card = state.tablePlays[i]
    if (!card) continue
    tablePlays[seat] = state.revealed[i] ? card.kind : 'down'
  }

  let duel: RowShamBoPublicDuel | null = null
  if (state.phase === 'resolve' || state.phase === 'reveal') {
    const step =
      state.resolveStepIndex >= 0 ? state.resolveSteps[state.resolveStepIndex] : null
    const seatOf = (playerIndex: number) => state.players[playerIndex]?.seat ?? -1
    duel = {
      stepIndex: state.resolveStepIndex,
      subphase: state.resolveSubphase ?? 'idle',
      outcome: step?.outcome ?? null,
      contestedSeats: step ? step.contested.map(seatOf).filter((s) => s >= 0) : [],
      nextSeat: step ? seatOf(step.next) : -1,
    }
  }

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
    tablePlays,
    duel,
    lastMessage: clipMsg(state.lastMessage || state.log[state.log.length - 1] || ''),
  }
}

function encodePlays(plays: RowShamBoPublicPlay[]): string {
  const chars = ['-', '-', '-', '-']
  for (let seat = 0; seat < 4; seat++) {
    const p = plays[seat]
    if (p == null) chars[seat] = '-'
    else if (p === 'down') chars[seat] = '*'
    else chars[seat] = kindWire(p)
  }
  return chars.join('')
}

function decodePlays(raw: string): RowShamBoPublicPlay[] {
  const out = emptyPlays()
  for (let seat = 0; seat < 4; seat++) {
    const ch = raw[seat] || '-'
    if (ch === '*' ) out[seat] = 'down'
    else if (ch === '-') out[seat] = null
    else out[seat] = parseKindWire(ch)
  }
  return out
}

function encodeArena(board: RowShamBoPublicBoard): string {
  const d = board.duel
  const step = d ? String(d.stepIndex) : '-'
  const sub = d ? subphaseWire(d.subphase) : 'i'
  const outcome = d ? outcomeWire(d.outcome) : '-'
  const next = d && d.nextSeat >= 0 ? String(d.nextSeat) : '-'
  const contested = d && d.contestedSeats.length ? d.contestedSeats.join('') : '-'
  return [step, sub, outcome, next, contested, encodePlays(board.tablePlays)].join(':')
}

function decodeArena(raw: string): {
  tablePlays: RowShamBoPublicPlay[]
  duel: RowShamBoPublicDuel | null
} {
  if (!raw) return { tablePlays: emptyPlays(), duel: null }
  const parts = raw.split(':')
  if (parts.length < 6) {
    // Legacy: bare 4-char plays
    if (raw.length === 4 && !raw.includes(':')) {
      return { tablePlays: decodePlays(raw), duel: null }
    }
    return { tablePlays: emptyPlays(), duel: null }
  }
  const stepRaw = parts[0]!
  const stepIndex = stepRaw === '-' ? -1 : Number(stepRaw)
  const sub = parseSubphase(parts[1] || 'i')
  const outcome = parseOutcome(parts[2] || '-')
  const nextRaw = parts[3]!
  const nextSeat = nextRaw === '-' ? -1 : Number(nextRaw)
  const contestedRaw = parts[4]!
  const contestedSeats =
    contestedRaw === '-' || !contestedRaw
      ? []
      : [...contestedRaw].map((c) => Number(c)).filter((n) => n >= 0 && n <= 3)
  const tablePlays = decodePlays(parts[5] || '----')
  const duel: RowShamBoPublicDuel | null =
    Number.isFinite(stepIndex) && (stepIndex >= 0 || sub !== 'idle')
      ? {
          stepIndex: Number.isFinite(stepIndex) ? stepIndex : -1,
          subphase: sub,
          outcome,
          contestedSeats,
          nextSeat: Number.isFinite(nextSeat) ? nextSeat : -1,
        }
      : stepIndex < 0 && sub === 'idle'
        ? {
            stepIndex: -1,
            subphase: 'idle',
            outcome: null,
            contestedSeats: [],
            nextSeat: -1,
          }
        : null
  return { tablePlays, duel }
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
  return `${head}^${players}^${encodeArena(board)}`
}

export function isRowShamBoBoardPayload(raw: string): boolean {
  return raw.trim().startsWith('W1~')
}

export function decodeRowShamBoPublicBoard(raw: string): RowShamBoPublicBoard {
  const text = raw.trim()
  if (!text || !text.startsWith('W1~')) return idleRowShamBoPublicBoard()
  const [headPart, playersPart = '', arenaPart = ''] = text.split('^')
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

  const { tablePlays, duel } = decodeArena(arenaPart)
  const phase = parsePhase(head[7] || 'i')

  return {
    live: true,
    variant: parseVariantWire(head[2] || 'c'),
    playerCount: Number(head[3]) || players.length || 2,
    handNumber: Number(head[4]) || 1,
    gameNumber: Number(head[5]) || 1,
    playTo: Number(head[6]) || 100,
    phase,
    buttonSeat: head[8] === '-' ? -1 : Number(head[8]),
    direction: dirCh === 'c' ? 'cw' : dirCh === 'a' ? 'ccw' : null,
    stockCount: Number(head[10]) || 0,
    players,
    tablePlays,
    duel:
      duel ??
      (phase === 'resolve' || phase === 'reveal'
        ? {
            stepIndex: -1,
            subphase: 'idle',
            outcome: null,
            contestedSeats: [],
            nextSeat: -1,
          }
        : null),
    lastMessage: clipMsg(head[11] || ''),
  }
}

export function rowShamBoSpectatorStatus(board: RowShamBoPublicBoard): string {
  if (!board.live) return 'Row! Sham! Bo! parlor open — waiting'
  if (board.phase === 'pass') return 'Passing cards…'
  if (board.phase === 'play') return 'Playing face-down…'
  if (board.phase === 'resolve' || board.phase === 'reveal') {
    const d = board.duel
    if (d && d.stepIndex >= 0) return `Duel ${d.stepIndex + 1}`
    return 'Battle!'
  }
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
