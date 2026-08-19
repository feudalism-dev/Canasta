import { isBlackThree, isWild, type Card } from '../core/cards'
import { claimCardsForPile, getLegalMoves, peekDiscard } from '../core/rules'
import type { GameMove, MatchState } from '../core/types'

export type AiDifficulty = 'easy' | 'normal' | 'sharp'

function discardScore(card: Card, pileSize: number, sharp: boolean): number {
  if (isWild(card)) return 1000
  if (isBlackThree(card)) return pileSize >= 5 ? -20 : 8
  if (card.rank === 'A') return sharp ? 40 : 25
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 18
  return 5 + (card.rank === '10' ? 4 : 0)
}

export function pickAiMove(state: MatchState, playerIndex: number, difficulty: AiDifficulty): GameMove | null {
  const moves = getLegalMoves(state, playerIndex)
  if (moves.length === 0) return null
  if (difficulty === 'easy') {
    const discards = moves.filter((m) => m.kind === 'discard')
    if (state.phase === 'awaitingPlay' && discards.length) {
      return discards[Math.floor(Math.random() * discards.length)]!
    }
    return moves[Math.floor(Math.random() * moves.length)]!
  }
  const sharp = difficulty === 'sharp'
  if (state.phase === 'awaitingGoOutConsent') {
    const yes = moves.find((m) => m.kind === 'consentGoOut' && m.accept)
    const no = moves.find((m) => m.kind === 'consentGoOut' && !m.accept)
    const me = state.players[playerIndex]!
    if (state.pendingGoOut && state.pendingGoOut.discardId === null && yes) return yes
    if (me.hand.length <= 8 && yes) return yes
    if (no && me.hand.length > 12) return no
    return yes ?? no ?? moves[0]!
  }
  if (state.phase === 'roundEnd') return { kind: 'continue' }
  if (state.phase === 'awaitingDraw') {
    const take = moves.find((m) => m.kind === 'takePile')
    const claim = claimCardsForPile(state, playerIndex)
    const top = peekDiscard(state)
    const pile = state.discard.length
    const team = state.teams[state.players[playerIndex]!.team]!
    if (take && claim && top) {
      if (pile >= (sharp ? 3 : 5)) return take
      if (!team.hasInitialMeld && (top.rank === 'A' || isWild(top))) return take
    }
    return { kind: 'drawStock' }
  }
  const melds = moves.filter((m) => m.kind === 'meld')
  const adds = moves.filter((m) => m.kind === 'addToMeld')
  const team = state.teams[state.players[playerIndex]!.team]!
  if (!team.hasInitialMeld) {
    if (melds[0]) return melds[0]
  } else {
    const closing = adds.find((m) => {
      if (m.kind !== 'addToMeld') return false
      const meld = team.melds[m.meldIndex]
      if (!meld) return false
      return meld.cards.length + m.cardIds.length >= state.config.canastaSize
    })
    if (closing) return closing
    if (adds[0]) return adds[0]
    if (melds[0] && sharp) return melds[0]
    if (melds[0] && Math.random() < 0.45) return melds[0]
  }
  const discards = moves.filter((m) => m.kind === 'discard')
  let best: GameMove | null = null
  let bestScore = Infinity
  for (const m of discards) {
    if (m.kind !== 'discard') continue
    const card = state.players[playerIndex]!.hand.find((c) => c.id === m.cardId)
    if (!card) continue
    const sc = discardScore(card, state.discard.length, sharp)
    if (sc < bestScore) {
      bestScore = sc
      best = m
    }
  }
  return best ?? discards[0] ?? moves[0]!
}
