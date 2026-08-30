import { isBlackThree, isWild, type Card } from '../core/cards'
import { isHandAndFoot } from '../core/houseRules'
import { isSequenceMeld, meldIsWildBook, teamCanastaCounts } from '../core/melds'
import { claimCardsForPile, getLegalMoves, peekDiscard } from '../core/rules'
import { partnerOf } from '../core/score'
import { meldIsSamba } from '../core/sequences'
import type { GameMove, MatchState, Meld } from '../core/types'

export type AiDifficulty = 'easy' | 'normal' | 'sharp'

function discardScore(card: Card, pileSize: number, sharp: boolean): number {
  if (isWild(card)) return 1000
  if (isBlackThree(card)) return pileSize >= 5 ? -20 : 8
  if (card.rank === 'A') return sharp ? 40 : 25
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 18
  return 5 + (card.rank === '10' ? 4 : 0)
}

function meldClosesBook(meld: Meld, adding: number, state: MatchState): boolean {
  const n = meld.cards.length + adding
  return n >= state.config.canastaSize
}

function closingAddPriority(meld: Meld, state: MatchState): number {
  const size = state.config.canastaSize
  if (meldIsSamba(meld, size)) return 100
  if (state.config.goingOutRule === 'bolivia' && meldIsWildBook(meld) && meld.cards.length + 1 >= size) return 95
  if (isSequenceMeld(meld) && meld.cards.length + 1 >= size) return 90
  if (!isSequenceMeld(meld) && meld.cards.length + 1 >= size) return 80
  if (isSequenceMeld(meld)) return 40 + meld.cards.length
  return 20 + meld.cards.length
}

/** Partner is ready to go out — this seat must open Foot (or finish) so the hand can end. */
function partnerWaitingOnFoot(state: MatchState, playerIndex: number): boolean {
  if (!isHandAndFoot(state.config.variant)) return false
  const me = state.players[playerIndex]!
  if (me.footPickedUp) return false
  const partner = partnerOf(state, playerIndex)
  if (!partner || !partner.footPickedUp) return false
  const books = teamCanastaCounts(state.teams[me.team]!.melds, state.config.canastaSize)
  const needC = state.config.house.goingOutClean
  const needD = state.config.house.goingOutDirty
  return books.clean >= needC && books.dirty + books.wild >= needD
}

export function pickAiMove(state: MatchState, playerIndex: number, difficulty: AiDifficulty): GameMove | null {
  const moves = getLegalMoves(state, playerIndex)
  if (moves.length === 0) return null
  const rushFoot = partnerWaitingOnFoot(state, playerIndex)
  if (difficulty === 'easy' && !rushFoot) {
    const melds = moves.filter((m) => m.kind === 'meld' || m.kind === 'addToMeld')
    // Still empty the Hand sometimes so a computer partner can open Foot.
    if (state.phase === 'awaitingPlay' && melds.length && Math.random() < 0.35) {
      return melds[Math.floor(Math.random() * melds.length)]!
    }
    const discards = moves.filter((m) => m.kind === 'discard')
    if (state.phase === 'awaitingPlay' && discards.length) {
      return discards[Math.floor(Math.random() * discards.length)]!
    }
    return moves[Math.floor(Math.random() * moves.length)]!
  }
  const sharp = difficulty === 'sharp' || rushFoot
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
    const takeSeq = moves.find((m) => m.kind === 'takeSequenceTop')
    const take = moves.find((m) => m.kind === 'takePile')
    const claim = claimCardsForPile(state, playerIndex)
    const top = peekDiscard(state)
    const pile = state.discard.length
    const team = state.teams[state.players[playerIndex]!.team]!
    if (state.config.sequencesEnabled && takeSeq && sharp) return takeSeq
    if (take && claim && top) {
      if (pile >= (sharp ? 3 : 5)) return take
      if (!team.hasInitialMeld && (top.rank === 'A' || isWild(top))) return take
    }
    if (state.config.sequencesEnabled && takeSeq && !state.config.blockTakePileOnWildTop) return takeSeq
    return { kind: 'drawStock' }
  }
  const melds = moves.filter((m) => m.kind === 'meld')
  const adds = moves.filter((m) => m.kind === 'addToMeld')
  const team = state.teams[state.players[playerIndex]!.team]!
  if (!team.hasInitialMeld) {
    if (melds[0]) return melds[0]
  } else {
    const closing = adds
      .filter((m) => {
        if (m.kind !== 'addToMeld') return false
        const meld = team.melds[m.meldIndex]
        if (!meld) return false
        return meldClosesBook(meld, m.cardIds.length, state)
      })
      .sort((a, b) => {
        const ma = team.melds[a.meldIndex]!
        const mb = team.melds[b.meldIndex]!
        return closingAddPriority(mb, state) - closingAddPriority(ma, state)
      })
    if (closing[0]) return closing[0]
    const extendSeq = adds
      .filter((m) => {
        if (m.kind !== 'addToMeld') return false
        const meld = team.melds[m.meldIndex]
        return Boolean(meld && isSequenceMeld(meld))
      })
      .sort((a, b) => {
        const ma = team.melds[a.meldIndex]!
        const mb = team.melds[b.meldIndex]!
        return mb.cards.length - ma.cards.length
      })
    if (extendSeq[0] && sharp) return extendSeq[0]
    if (adds[0]) return adds[0]
    if (state.config.sequencesEnabled) {
      const seqMeld = melds.find((m) => {
        if (m.kind !== 'meld') return false
        return m.cardIds.some((id) => {
          const card = state.players[playerIndex]!.hand.find((c) => c.id === id)
          return card && !isWild(card)
        })
      })
      if (seqMeld && sharp) return seqMeld
    }
    if (melds[0] && (sharp || rushFoot)) return melds[0]
    if (melds[0] && Math.random() < 0.45) return melds[0]
  }
  const pass = moves.find((m) => m.kind === 'pass')
  if (pass && state.config.sequencesEnabled && !melds.length && !adds.length) return pass
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
