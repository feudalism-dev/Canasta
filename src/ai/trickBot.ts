import { type Suit, SUITS } from '../core/cards'
import { cardPenalty, isQueenOfSpades, trickRankValue } from '../core/trick/deck'
import {
  isRoosterBird,
  roosterCounterPoints,
  roosterRankValue,
  ROOSTER_MIN_BID,
} from '../core/trick/roosterDeck'
import { suggestedBids, teamOfIndex } from '../core/trick/roosterRules'
import { applyTrickMove, legalPlays } from '../core/trick/rules'
import { currentPlayer } from '../core/trick/state'
import type { TrickMove, TrickState } from '../core/trick/types'

/** Dump high penalties when passing; keep low clubs otherwise. */
function passPick(state: TrickState): string[] {
  const me = currentPlayer(state)
  const ranked = [...me.hand].sort((a, b) => {
    const pa = cardPenalty(a) * 10 + (a.suit === 'S' && a.rank === 'A' ? 5 : 0) + (a.suit === 'S' ? 1 : 0)
    const pb = cardPenalty(b) * 10 + (b.suit === 'S' && b.rank === 'A' ? 5 : 0) + (b.suit === 'S' ? 1 : 0)
    return pb - pa
  })
  return ranked.slice(0, 3).map((c) => c.id)
}

/** Prefer low safe cards; avoid taking the Q♠ / hearts when possible. */
function playPickHearts(state: TrickState): string | null {
  const legal = legalPlays(state, state.current)
  if (!legal.length) return null
  const ranked = [...legal].sort((a, b) => {
    const dangerA = cardPenalty(a) * 20 + (isQueenOfSpades(a) ? 50 : 0)
    const dangerB = cardPenalty(b) * 20 + (isQueenOfSpades(b) ? 50 : 0)
    if (dangerA !== dangerB) return dangerA - dangerB
    return trickRankValue(a.rank) - trickRankValue(b.rank)
  })
  return ranked[0]!.id
}

function countTrumpStrength(hand: TrickState['players'][0]['hand']): { best: Suit; score: number } {
  let best: Suit = 'C'
  let bestScore = -1
  for (const s of SUITS) {
    let score = 0
    for (const c of hand) {
      if (isRoosterBird(c)) score += 8
      else if (c.suit === s) score += roosterRankValue(c) >= 12 ? 3 : 1
    }
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return { best, score: bestScore }
}

function roosterBidPick(state: TrickState): TrickMove {
  const me = currentPlayer(state)
  const { score } = countTrumpStrength(me.hand)
  const want =
    score >= 18 ? 100 : score >= 14 ? 85 : score >= 10 ? ROOSTER_MIN_BID : 0
  if (want === 0 || want <= state.bidAmount) {
    // Forced dealer min bid
    const othersPassed = state.bidPassed.filter((p, i) => i !== state.current && p).length >= 3
    if (othersPassed && state.bidAmount === 0) {
      return { t: 'bid', amount: ROOSTER_MIN_BID }
    }
    return { t: 'passBid' }
  }
  const opts = suggestedBids(state)
  const pick = opts.find((a) => a >= want) ?? opts[0]
  if (!pick) return { t: 'passBid' }
  return { t: 'bid', amount: pick }
}

function roosterNestPick(state: TrickState): string[] {
  const me = currentPlayer(state)
  // Bury lowest non-counters first; keep trump candidates and high counters.
  const ranked = [...me.hand].sort((a, b) => {
    const ca = roosterCounterPoints(a)
    const cb = roosterCounterPoints(b)
    if (ca !== cb) return ca - cb
    if (isRoosterBird(a)) return 1
    if (isRoosterBird(b)) return -1
    return roosterRankValue(a) - roosterRankValue(b)
  })
  return ranked.slice(0, 5).map((c) => c.id)
}

function roosterTrumpPick(state: TrickState): Suit {
  return countTrumpStrength(currentPlayer(state).hand).best
}

function playPickRooster(state: TrickState): string | null {
  const legal = legalPlays(state, state.current)
  if (!legal.length) return null
  const me = state.current
  const myTeam = teamOfIndex(me)
  const trump = state.trump

  if (state.trick.length === 0) {
    // Lead low non-counter off-suit when possible
    const ranked = [...legal].sort((a, b) => {
      const ca = roosterCounterPoints(a) * 10 + (isRoosterBird(a) ? 50 : 0)
      const cb = roosterCounterPoints(b) * 10 + (isRoosterBird(b) ? 50 : 0)
      if (ca !== cb) return ca - cb
      return roosterRankValue(a) - roosterRankValue(b)
    })
    return ranked[0]!.id
  }

  // Try to win if counters in trick and we can beat; else dump low
  let trickPts = 0
  for (const p of state.trick) trickPts += roosterCounterPoints(p.card)
  const winning = (() => {
    // simplistic: play highest trump/legal if points on table
    if (trickPts < 5) return false
    return true
  })()

  const ranked = [...legal].sort((a, b) => {
    const ra = roosterRankValue(a) + (trump && (a.suit === trump || isRoosterBird(a)) ? 20 : 0)
    const rb = roosterRankValue(b) + (trump && (b.suit === trump || isRoosterBird(b)) ? 20 : 0)
    return winning ? rb - ra : ra - rb
  })
  void myTeam
  return ranked[0]!.id
}

export function pickTrickBotMove(state: TrickState): TrickMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null

  if (state.config.variant === 'rooster') {
    if (state.phase === 'bid') return roosterBidPick(state)
    if (state.phase === 'nest') return { t: 'nestDiscard', cardIds: roosterNestPick(state) }
    if (state.phase === 'trump') return { t: 'nameTrump', suit: roosterTrumpPick(state) }
    if (state.phase === 'play') {
      const id = playPickRooster(state)
      if (!id) return null
      return { t: 'play', cardId: id }
    }
    return null
  }

  if (state.phase === 'pass') {
    if (state.passDirection === 'hold') return null
    return { t: 'pass', cardIds: passPick(state) }
  }
  if (state.phase === 'play') {
    const id = playPickHearts(state)
    if (!id) return null
    return { t: 'play', cardId: id }
  }
  return null
}

export function stepTrickBot(state: TrickState): TrickState | null {
  const move = pickTrickBotMove(state)
  if (!move) return null
  const res = applyTrickMove(state, move)
  return res.ok ? res.state : null
}

const THINK_MS = 380

export async function pumpTrickBots(
  state: TrickState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: TrickState) => void
  },
): Promise<TrickState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      const me = currentPlayer(cur)
      if (!me.isComputer) break
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      await new Promise((r) => window.setTimeout(r, THINK_MS))
      if (opts.isCancelled()) break
      const next = stepTrickBot(cur)
      if (!next) break
      cur = next
      opts.onStep(cur)
    }
  } finally {
    opts.onThinking(false)
  }
  return cur
}
