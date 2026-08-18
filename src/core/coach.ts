import { groupByRank, isBlackThree, isWild, rankLabel, type Card } from './cards'
import { canAddCards, inferMeldRank, teamCanastaCounts, validateMeldCards } from './melds'
import {
  claimCardsForPile,
  initialMeldMinimum,
  isMyDraw,
  peekDiscard,
  pileFrozenFor,
  pileIsStopped,
  planPileTake,
} from './rules'
import { partnerOf } from './score'
import type { MatchState } from './types'

export function whatShouldIDo(state: MatchState, playerIndex: number): string {
  const me = state.players[playerIndex]
  if (!me) return ''
  if (state.phase === 'matchEnd') return 'Match over — new game from the menu.'
  if (state.phase === 'roundEnd') return 'Hand scored. Continue when you are ready.'
  if (state.phase === 'awaitingGoOutConsent') {
    const pending = state.pendingGoOut
    if (pending && pending.playerIndex !== playerIndex) {
      const asker = state.players[pending.playerIndex]
      if (asker && asker.team === me.team) {
        return `${asker.displayName} wants to go out. Approve only if you are ready.`
      }
      return `${asker?.displayName ?? 'A player'} asked their partner for permission to go out.`
    }
    const mate = pending ? partnerOf(state, pending.playerIndex) : null
    return `Waiting for ${mate?.displayName ?? 'your partner'} to answer.`
  }
  if (state.currentPlayer !== playerIndex) {
    return `${state.players[state.currentPlayer]!.displayName}'s turn.`
  }
  const team = state.teams[me.team]!
  const need = initialMeldMinimum(state.config, team.score, state.round)
  if (isMyDraw(state, playerIndex)) {
    const top = peekDiscard(state)
    const plan = planPileTake(state, playerIndex)
    if (plan.ok) {
      const n = state.discard.length
      const label = top ? rankLabel(top.rank) : 'card'
      return `Your turn. You can take the pile (${n} cards) and meld the ${label}, or draw from the stock.`
    }
    if (!plan.ok) {
      if (claimCardsForPile(state, playerIndex) !== null) return `Your turn. ${plan.error}`
    }
    const n = state.config.stockDraw
    const frozen = top && pileFrozenFor(state, playerIndex) && !pileIsStopped(state)
    const freezeNote = frozen ? ' The pile is frozen — two matching naturals, and enough points to meld.' : ''
    return n === 1
      ? `Your turn. Draw from the stock, or take the pile if it is legal.${freezeNote}`
      : `Your turn. Draw two from the stock, or take the pile with two matching naturals.${freezeNote}`
  }
  if (!team.hasInitialMeld) {
    return `Your turn. Need ${need} to meld. Build one or more sets in your hand — the meter counts all of them, and nothing is shown to others until you press Meld.`
  }
  const books = teamCanastaCounts(team.melds, state.config.canastaSize)
  if (state.config.variant === 'handAndFoot') {
    if (!me.footPickedUp) return 'Your turn. Meld or discard. Empty your Hand to pick up the Foot.'
    const needC = state.config.house.goingOutClean
    const needD = state.config.house.goingOutDirty
    if (books.clean < needC || books.dirty < needD) {
      return `Your turn. Books: ${books.clean} clean, ${books.dirty} dirty. Need ${needC} clean and ${needD} dirty to go out.`
    }
    if (state.config.requireDiscardToGoOut) {
      return 'Your turn. You have the books. Discard your last card to go out (ask partner first).'
    }
    return 'Your turn. You have the books. You may meld your last cards or discard to go out.'
  }
  if (books.clean + books.dirty === 0) return 'Your turn. Build a canasta of seven before you can go out.'
  return 'Your turn. Add to melds. You may meld your last cards to go out, or discard.'
}

export type CoachAdvice = { headline: string; tip: string }

export function coachAdvice(
  state: MatchState,
  playerIndex: number,
  opts?: { tips?: boolean; selectedIds?: Iterable<string> },
): CoachAdvice {
  const headline = whatShouldIDo(state, playerIndex)
  if (!opts?.tips) return { headline, tip: '' }
  return { headline, tip: lessonFor(state, playerIndex, [...(opts.selectedIds ?? [])]) }
}

function lessonFor(state: MatchState, playerIndex: number, selectedIds: string[]): string {
  const me = state.players[playerIndex]
  if (!me) return ''
  if (state.phase === 'matchEnd' || state.phase === 'roundEnd') {
    return 'Scores add card points and book bonuses, minus cards left in hand. Continue when you are ready.'
  }
  if (state.phase === 'awaitingGoOutConsent') {
    return 'Only your partner answers. Yes ends the hand; Not yet keeps the last card and play continues.'
  }
  if (state.currentPlayer !== playerIndex) {
    return 'Watch their discard. A black 3 stops the next player from taking the pile. A wild freezes it.'
  }

  const team = state.teams[me.team]!
  const them = state.teams[me.team === 0 ? 1 : 0]!
  const cfg = state.config
  const top = peekDiscard(state)
  const selected = selectedIds
    .map((id) => me.hand.find((c) => c.id === id))
    .filter((c): c is Card => Boolean(c))

  if (isMyDraw(state, playerIndex)) {
    if (top && isBlackThree(top)) {
      return 'A black 3 on top is a stop card. Draw from the stock — nobody can take that pile.'
    }
    if (top && isWild(top)) {
      return 'A wild on top freezes the pile and cannot be taken. Draw from the stock.'
    }
    const plan = planPileTake(state, playerIndex)
    if (plan.ok) {
      const n = state.discard.length
      if (!team.hasInitialMeld) {
        return `You may take all ${n} cards, but only the top discard plus cards from your hand count toward the ${initialMeldMinimum(cfg, team.score, state.round)}-point opening.`
      }
      return `Taking the pile gives you every card in it. You must meld the ${top ? rankLabel(top.rank) : 'top'} immediately. Big piles are usually worth it.`
    }
    if (top && pileFrozenFor(state, playerIndex)) {
      return `Frozen piles need two natural ${rankLabel(top.rank)}s from your hand — wilds cannot substitute for the pickup.`
    }
    if (cfg.variant === 'handAndFoot') {
      return 'Hand and Foot always treats the pile as frozen: two matching naturals of the top rank, then draw is the other choice.'
    }
    return 'Draw from the stock. After you draw you may meld, then you must discard one card to end the turn.'
  }

  if (selected.length === 1) {
    const c = selected[0]!
    if (isWild(c)) {
      return 'Discarding a 2 or joker freezes the pile. The next player will need two naturals to take it.'
    }
    if (isBlackThree(c)) {
      return 'A black 3 is a stop discard — it blocks the next player from taking the pile. It is not a normal meld.'
    }
    const threat = them.melds.find((m) => m.rank === c.rank)
    if (threat) {
      return `They already have ${rankLabel(c.rank)}s down. Throwing one often feeds their book or lets them take the pile.`
    }
    return 'One card selected is your discard. After you discard, the turn passes.'
  }

  if (selected.length >= 2) {
    const rank = inferMeldRank(selected)
    if (rank && !validateMeldCards(selected, rank, cfg)) {
      if (!team.hasInitialMeld) {
        const need = initialMeldMinimum(cfg, team.score, state.round)
        return `Those cards are a legal set. If the meter is still under ${need}, park this set and tap another rank — several sets can add up. Nothing is shown until you press Meld.`
      }
      return 'That set is complete. Press Meld, or tap an open book of the same rank to add onto it.'
    }
    const addable = team.melds.find((m) => !canAddCards(m, selected, cfg))
    if (addable) {
      return `Those cards can join your ${addable.rank === 'WILD' ? 'wild' : rankLabel(addable.rank)} book. Press Add, or tap that book.`
    }
    if (selected.length === 2 && selected.every((c) => !isWild(c) && c.rank === selected[0]!.rank)) {
      return `A meld needs three cards. Add another ${rankLabel(selected[0]!.rank)} or a wild (2 or joker).`
    }
  }

  if (!team.hasInitialMeld) {
    const need = initialMeldMinimum(cfg, team.score, state.round)
    const hint = openingHint(me.hand)
    if (hint) return `${hint} The meter must reach ${need} before Meld will put anything on the table.`
    return `Tap a rank group to select it. Wilds are 2s and jokers. Several incomplete-looking sets can still add up to ${need} if each is a legal three-card meld.`
  }

  if (cfg.variant === 'handAndFoot' && !me.footPickedUp) {
    return 'Play the 13-card Hand first. Meld or discard until it is empty — then you pick up the Foot and keep going if you emptied it by melding.'
  }

  const books = teamCanastaCounts(team.melds, cfg.canastaSize)
  if (cfg.variant === 'handAndFoot') {
    const needC = cfg.house.goingOutClean
    const needD = cfg.house.goingOutDirty
    if (books.clean < needC || books.dirty < needD) {
      return `Clean books are seven naturals (no wilds). Dirty books mix in wilds. You need ${needC} clean and ${needD} dirty before anyone on your team can go out.`
    }
    if (cfg.requireDiscardToGoOut) {
      return 'To go out, empty the Foot and discard the last card. Keep one card in hand until that discard.'
    }
    return 'You may meld your last cards to go out, or discard the last one. A computer partner always allows it.'
  }

  if (books.clean + books.dirty === 0) {
    const hint = openingHint(me.hand)
    if (hint) return `${hint} Seven of a rank is a canasta. You need one canasta before you can go out.`
    return 'Add to your melds until one reaches seven. Natural canastas (no wilds) score more than mixed ones.'
  }

  return 'Add leftover cards to your books, then discard. In Classic Canasta you may meld the last cards with no leftover discard.'
}

function openingHint(hand: Card[]): string {
  const wilds = hand.filter((c) => isWild(c)).length
  const groups = groupByRank(hand.filter((c) => !isWild(c) && c.rank !== '3'))
  let bestRank = ''
  let bestN = 0
  groups.forEach((cards, rank) => {
    if (cards.length > bestN) {
      bestN = cards.length
      bestRank = rank
    }
  })
  if (bestN >= 3) {
    return `You have ${bestN} ${rankLabel(bestRank as Card['rank'])}s — tap that group to select them.`
  }
  if (bestN === 2 && wilds > 0) {
    return `Two ${rankLabel(bestRank as Card['rank'])}s plus a wild make a meld. Tap the ${rankLabel(bestRank as Card['rank'])}s, then a 2 or joker.`
  }
  return ''
}
