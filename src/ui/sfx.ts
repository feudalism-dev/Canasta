import { eventsForMove } from '../core/displayEvents'
import type { GameMove, MatchState } from '../core/types'
import { readSfxEnabled } from './sfxPref'

export type SfxId =
  | 'shuffle'
  | 'deal'
  | 'draw'
  | 'draw2'
  | 'discard'
  | 'meld'
  | 'take-pile'
  | 'canasta'
  | 'book'
  | 'foot'
  | 'go-out'
  | 'round-end'
  | 'your-turn'

const FILE: Record<SfxId, string> = {
  shuffle: 'shuffle.ogg',
  deal: 'deal.ogg',
  draw: 'draw.ogg',
  draw2: 'draw2.ogg',
  discard: 'discard.ogg',
  meld: 'meld.ogg',
  'take-pile': 'take-pile.ogg',
  canasta: 'canasta.ogg',
  book: 'book.ogg',
  foot: 'foot.ogg',
  'go-out': 'go-out.ogg',
  'round-end': 'round-end.ogg',
  'your-turn': 'your-turn.ogg',
}

const VOLUME: Partial<Record<SfxId, number>> = {
  shuffle: 0.45,
  deal: 0.4,
  draw: 0.35,
  draw2: 0.35,
  discard: 0.4,
  meld: 0.45,
  'take-pile': 0.5,
  canasta: 0.55,
  book: 0.4,
  foot: 0.45,
  'go-out': 0.55,
  'round-end': 0.4,
  'your-turn': 0.55,
}

const cache = new Map<SfxId, HTMLAudioElement>()
let unlocked = false
let lastPlayAt = 0
let audioCtx: AudioContext | null = null

function urlFor(id: SfxId): string {
  return `${import.meta.env.BASE_URL}sfx/${FILE[id]}`
}

function getAudio(id: SfxId): HTMLAudioElement {
  let a = cache.get(id)
  if (!a) {
    a = new Audio(urlFor(id))
    a.preload = 'auto'
    cache.set(id, a)
  }
  return a
}

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

/** Call from a user gesture so CEF / browsers allow later plays. */
export function unlockSfx(): void {
  if (unlocked) return
  unlocked = true
  try {
    getAudioCtx()
    const a = getAudio('draw')
    a.volume = 0
    void a
      .play()
      .then(() => {
        a.pause()
        a.currentTime = 0
        a.volume = VOLUME.draw ?? 0.4
      })
      .catch(() => {
        /* still blocked — next gesture retries */
        unlocked = false
      })
  } catch {
    unlocked = false
  }
}

export function preloadSfx(): void {
  ;(Object.keys(FILE) as SfxId[]).forEach((id) => {
    if (id === 'your-turn') return
    try {
      getAudio(id)
    } catch {
      /* ignore */
    }
  })
}

export function playSfx(id: SfxId): void {
  if (!readSfxEnabled()) return
  if (id === 'your-turn') {
    playYourTurnBell()
    return
  }
  unlockSfx()
  const now = Date.now()
  if (now - lastPlayAt < 40) {
    /* allow stacked cues (meld+canasta) but avoid click spam */
  }
  lastPlayAt = now
  try {
    const base = getAudio(id)
    const a = base.cloneNode(true) as HTMLAudioElement
    a.volume = VOLUME[id] ?? 0.4
    void a.play().catch(() => {
      /* autoplay / missing file */
    })
  } catch {
    /* ignore */
  }
}

/**
 * Short two-note chime when it becomes the local player's turn.
 * Synthesized so CEF always has a cue even without a media file.
 */
export function playYourTurnBell(): void {
  if (!readSfxEnabled()) return
  unlockSfx()
  const ctx = getAudioCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = VOLUME['your-turn'] ?? 0.55
  master.connect(ctx.destination)

  const ding = (freq: number, start: number, dur: number) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(0.7, start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  // Soft parlor bell: A5 then E6
  ding(880, now, 0.28)
  ding(1318.5, now + 0.16, 0.38)
}

/** Deal / new hand sting. */
export function playDealSfx(): void {
  if (!readSfxEnabled()) return
  playSfx('shuffle')
  window.setTimeout(() => playSfx('deal'), 280)
}

/**
 * Map a successful rules apply to HUD sounds.
 * Uses the same pipe events as the table display when `prev` is available.
 */
export function playSfxForMove(
  prev: MatchState | null,
  next: MatchState | null,
  move: GameMove,
  playerIndex: number,
): void {
  if (!readSfxEnabled()) return

  if (!prev || !next) {
    playSfxFromMoveOnly(move)
    return
  }

  const kinds = eventsForMove(prev, next, move, playerIndex).map((p) => p.split('|')[0]!)

  if (kinds.includes('GAME_OVER')) {
    playSfx('go-out')
    return
  }
  if (next.phase === 'roundEnd' && (prev.phase !== 'roundEnd' || kinds.includes('SCORE'))) {
    if (move.kind === 'continue') return
    playSfx('round-end')
  }
  if (kinds.includes('CANASTA')) {
    playSfx('canasta')
    window.setTimeout(() => playSfx('book'), 90)
  } else if (kinds.includes('MELD')) {
    playSfx('meld')
  }
  if (kinds.includes('FOOT')) playSfx('foot')
  if (kinds.includes('TAKE_PILE')) playSfx('take-pile')
  else if (kinds.includes('DRAW')) playSfx(Math.random() < 0.5 ? 'draw' : 'draw2')
  if (kinds.includes('DISCARD')) playSfx('discard')
}

function playSfxFromMoveOnly(move: GameMove): void {
  if (move.kind === 'drawStock') playSfx(Math.random() < 0.5 ? 'draw' : 'draw2')
  else if (move.kind === 'takePile' || move.kind === 'takeSequenceTop') playSfx('take-pile')
  else if (move.kind === 'discard') playSfx('discard')
  else if (move.kind === 'meld' || move.kind === 'addToMeld') playSfx('meld')
  else if (move.kind === 'goOut') playSfx('go-out')
}
