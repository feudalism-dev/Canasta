import { type Suit, SUITS } from '../core/cards'
import { cardPenalty, isQueenOfSpades, trickRankValue } from '../core/trick/deck'
import {
  isRoosterBird,
  roosterCounterPoints,
  roosterRankValue,
  ROOSTER_MIN_BID,
} from '../core/trick/roosterDeck'
import { suggestedBids } from '../core/trick/roosterRules'
import { suggestEuchreBid } from '../core/trick/euchreRules'
import { suggestOhHellBid } from '../core/trick/ohHellRules'
import { suggestSpadesBid } from '../core/trick/spadesRules'
import { applyTrickMove, legalPlays } from '../core/trick/rules'
import { currentPlayer } from '../core/trick/state'
import type { TrickMove, TrickState } from '../core/trick/types'

function passPick(state: TrickState): string[] {
  const me = currentPlayer(state)
  const ranked = [...me.hand].sort((a, b) => {
    const pa = cardPenalty(a) * 10 + (a.suit === 'S' && a.rank === 'A' ? 5 : 0) + (a.suit === 'S' ? 1 : 0)
    const pb = cardPenalty(b) * 10 + (b.suit === 'S' && b.rank === 'A' ? 5 : 0) + (b.suit === 'S' ? 1 : 0)
    return pb - pa
  })
  return ranked.slice(0, 3).map((c) => c.id)
}

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
  const want = score >= 18 ? 100 : score >= 14 ? 85 : score >= 10 ? ROOSTER_MIN_BID : 0
  if (want === 0 || want <= state.bidAmount) {
    const othersPassed = state.bidPassed.filter((p, i) => i !== state.current && p).length >= 3
    if (othersPassed && state.bidAmount === 0) return { t: 'bid', amount: ROOSTER_MIN_BID }
    return { t: 'passBid' }
  }
  const opts = suggestedBids(state)
  const pick = opts.find((a) => a >= want) ?? opts[0]
  if (!pick) return { t: 'passBid' }
  return { t: 'bid', amount: pick }
}

function roosterNestPick(state: TrickState): string[] {
  const me = currentPlayer(state)
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

function playPickGeneric(state: TrickState, preferWin: boolean): string | null {
  const legal = legalPlays(state, state.current)
  if (!legal.length) return null
  const trump = state.trump
  const ranked = [...legal].sort((a, b) => {
    const ta = trump && a.suit === trump ? 1 : 0
    const tb = trump && b.suit === trump ? 1 : 0
    const ra = trickRankValue(a.rank) + ta * 20
    const rb = trickRankValue(b.rank) + tb * 20
    return preferWin ? rb - ra : ra - rb
  })
  return ranked[0]!.id
}

function playPickRooster(state: TrickState): string | null {
  let trickPts = 0
  for (const p of state.trick) trickPts += roosterCounterPoints(p.card)
  return playPickGeneric(state, trickPts >= 5)
}

function playPickSpades(state: TrickState): string | null {
  const me = state.current
  const bid = state.playerBids[me] ?? 1
  const took = state.tricksTaken[me] ?? 0
  const need = bid === 0 ? false : took < bid
  return playPickGeneric(state, need)
}

function playPickOhHell(state: TrickState): string | null {
  const me = state.current
  const bid = state.playerBids[me] ?? 0
  const took = state.tricksTaken[me] ?? 0
  return playPickGeneric(state, took < bid)
}

export function pickTrickBotMove(state: TrickState): TrickMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null
  const v = state.config.variant

  if (v === 'rooster') {
    if (state.phase === 'bid') return roosterBidPick(state)
    if (state.phase === 'nest') return { t: 'nestDiscard', cardIds: roosterNestPick(state) }
    if (state.phase === 'trump') return { t: 'nameTrump', suit: countTrumpStrength(me.hand).best }
    if (state.phase === 'play') {
      const id = playPickRooster(state)
      return id ? { t: 'play', cardId: id } : null
    }
    return null
  }

  if (v === 'spades') {
    if (state.phase === 'bid') return { t: 'bid', amount: suggestSpadesBid(state) }
    if (state.phase === 'play') {
      const id = playPickSpades(state)
      return id ? { t: 'play', cardId: id } : null
    }
    return null
  }

  if (v === 'euchre') {
    if (state.phase === 'bid') return suggestEuchreBid(state)
    if (state.phase === 'nest') {
      const worst = [...me.hand].sort((a, b) => trickRankValue(a.rank) - trickRankValue(b.rank))[0]
      return worst ? { t: 'nestDiscard', cardIds: [worst.id] } : null
    }
    if (state.phase === 'play') {
      const id = playPickGeneric(state, true)
      return id ? { t: 'play', cardId: id } : null
    }
    return null
  }

  if (v === 'ohhell') {
    if (state.phase === 'bid') return { t: 'bid', amount: suggestOhHellBid(state) }
    if (state.phase === 'play') {
      const id = playPickOhHell(state)
      return id ? { t: 'play', cardId: id } : null
    }
    return null
  }

  if (state.phase === 'pass') {
    if (state.passDirection === 'hold') return null
    return { t: 'pass', cardIds: passPick(state) }
  }
  if (state.phase === 'play') {
    const id = playPickHearts(state)
    return id ? { t: 'play', cardId: id } : null
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
      // Alone partner sits out — never stall the pump on them
      if (cur.alone && cur.bidderIndex != null && cur.current === (cur.bidderIndex + 2) % 4) {
        cur = {
          ...cur,
          current: (cur.current + 1) % cur.players.length,
        }
        opts.onStep(cur)
        continue
      }
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
