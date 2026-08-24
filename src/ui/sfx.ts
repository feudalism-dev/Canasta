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
}

const cache = new Map<SfxId, HTMLAudioElement>()
let unlocked = false
let lastPlayAt = 0

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

/** Call from a user gesture so CEF / browsers allow later plays. */
export function unlockSfx(): void {
  if (unlocked) return
  unlocked = true
  try {
    const a = getAudio('draw')
    a.volume = 0
    void a.play().then(() => {
      a.pause()
      a.currentTime = 0
      a.volume = VOLUME.draw ?? 0.4
    }).catch(() => {
      /* still blocked — next gesture retries */
      unlocked = false
    })
  } catch {
    unlocked = false
  }
}

export function preloadSfx(): void {
  ;(Object.keys(FILE) as SfxId[]).forEach((id) => {
    try {
      getAudio(id)
    } catch {
      /* ignore */
    }
  })
}

export function playSfx(id: SfxId): void {
  if (!readSfxEnabled()) return
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
