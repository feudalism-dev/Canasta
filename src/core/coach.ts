import { rankLabel } from './cards'
import { teamCanastaCounts } from './melds'
import { claimCardsForPile, initialMeldMinimum, isMyDraw, peekDiscard, pileFrozenFor, pileIsStopped, planPileTake } from './rules'
import type { MatchState } from './types'

export function whatShouldIDo(state: MatchState, playerIndex: number): string {
  const me = state.players[playerIndex]
  if (!me) return ''
  if (state.phase === 'matchEnd') return 'Match over — new game from the menu.'
  if (state.phase === 'roundEnd') return 'Hand scored. Continue when you are ready.'
  if (state.phase === 'awaitingGoOutConsent') {
    const pending = state.pendingGoOut
    if (pending && state.players[pending.playerIndex]?.team === me.team && pending.playerIndex !== playerIndex) {
      return 'Your partner wants to go out. Approve only if you are ready.'
    }
    return 'Waiting for your partner to answer.'
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
    return 'Your turn. You have the books. Discard your last card to go out (ask partner first).'
  }
  if (books.clean + books.dirty === 0) return 'Your turn. Build a canasta of seven before you can go out.'
  return 'Your turn. Add to melds, then discard. Last card can go out if you have a canasta.'
}
