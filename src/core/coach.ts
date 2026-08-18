import { rankLabel } from './cards'
import { teamCanastaCounts } from './melds'
import { claimCardsForPile, initialMeldMinimum, isMyDraw, peekDiscard, pileIsStopped } from './rules'
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
    return `${state.players[state.currentPlayer]!.displayName} is playing.`
  }
  const team = state.teams[me.team]!
  const need = initialMeldMinimum(state.config, team.score, state.round)
  if (isMyDraw(state, playerIndex)) {
    const top = peekDiscard(state)
    if (!pileIsStopped(state) && claimCardsForPile(state, playerIndex)) {
      const n = state.discard.length
      const label = top ? rankLabel(top.rank) : 'card'
      return `You can take the pile (${n} cards) with ${label}s.`
    }
    const n = state.config.stockDraw
    return n === 1 ? 'Draw from the stock, or take the pile if it is legal.' : 'Draw two from the stock, or take the pile with two matching naturals.'
  }
  if (!team.hasInitialMeld) {
    return `Need ${need} to meld. Select a rank group — the meter counts for you.`
  }
  const books = teamCanastaCounts(team.melds, state.config.canastaSize)
  if (state.config.variant === 'handAndFoot') {
    if (!me.footPickedUp) return 'Meld or discard. Empty your Hand to pick up the Foot.'
    const needC = state.config.house.goingOutClean
    const needD = state.config.house.goingOutDirty
    if (books.clean < needC || books.dirty < needD) {
      return `Books: ${books.clean} clean, ${books.dirty} dirty. Need ${needC} clean and ${needD} dirty to go out.`
    }
    return 'You have the books. Discard your last card to go out (ask partner first).'
  }
  if (books.clean + books.dirty === 0) return 'Build a canasta of seven before you can go out.'
  return 'Add to melds, then discard. Last card can go out if you have a canasta.'
}
