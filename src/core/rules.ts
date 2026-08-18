import {
  cardPoints,
  findCard,
  isBlackThree,
  isRedThree,
  isWild,
  meldCountPoints,
  sortHand,
  takeCards,
  type Card,
  type MeldRank,
} from './cards'
import {
  canAddCards,
  canastaKind,
  closeIfNeeded,
  inferMeldRank,
  meldIsCanasta,
  teamCanastaCounts,
  validateMeldCards,
} from './melds'
import { partnerOf, scoreTeamHand } from './score'
import { cloneState, flushRedThrees, maybePickupFoot, resetHandKeepScores } from './state'
import type { ApplyResult, GameMove, MatchState, Meld, TeamState } from './types'
import { initialMeldMinimum } from './variants'

export { cloneState } from './state'
export { createMatch } from './state'
export type { GameMove, MatchState } from './types'

export function peekDiscard(state: MatchState): Card | undefined {
  return state.discard[state.discard.length - 1]
}

export function currentTeam(state: MatchState): TeamState {
  return state.teams[state.players[state.currentPlayer]!.team]!
}

export function pileIsStopped(state: MatchState): boolean {
  const top = peekDiscard(state)
  if (!top) return true
  return isWild(top) || isBlackThree(top)
}

export function pileFrozenFor(state: MatchState, playerIndex: number): boolean {
  if (state.config.takePileNeedsTwoNaturalsAlways) return true
  if (state.discardFrozen) return true
  const team = state.teams[state.players[playerIndex]!.team]!
  return !team.hasInitialMeld
}

function existingOpenMeld(team: TeamState, rank: MeldRank): Meld | undefined {
  return team.melds.find((m) => m.rank === rank && !m.closed)
}

export function claimCardsForPile(state: MatchState, playerIndex: number): string[] | null {
  if (state.phase !== 'awaitingDraw') return null
  if (pileIsStopped(state)) return null
  const top = peekDiscard(state)!
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const naturals = player.hand.filter((c) => c.rank === top.rank && !isWild(c))
  const wilds = player.hand.filter((c) => isWild(c))
  const frozen = pileFrozenFor(state, playerIndex)
  const existing = existingOpenMeld(team, top.rank as MeldRank)
  if (frozen) {
    if (naturals.length < 2) return null
    return [naturals[0]!.id, naturals[1]!.id]
  }
  if (naturals.length >= 2) return [naturals[0]!.id, naturals[1]!.id]
  if (naturals.length === 1 && existing) return [naturals[0]!.id]
  if (naturals.length === 1 && wilds.length >= 1) return [naturals[0]!.id, wilds[0]!.id]
  return null
}

export function takePileLegal(state: MatchState, playerIndex: number, cardIds: string[]): ApplyResult {
  if (state.phase !== 'awaitingDraw') return { ok: false, error: 'It is not time to draw.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  if (pileIsStopped(state)) return { ok: false, error: 'The discard pile cannot be taken.' }
  const top = peekDiscard(state)!
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const { taken, missing } = takeCards(player.hand, cardIds)
  if (missing.length) return { ok: false, error: 'Those cards are not in your hand.' }
  const naturals = taken.filter((c) => c.rank === top.rank && !isWild(c))
  const wilds = taken.filter((c) => isWild(c))
  const extras = taken.filter((c) => !naturals.includes(c) && !wilds.includes(c))
  if (extras.length) return { ok: false, error: 'Only cards that claim the top discard may be used to take the pile.' }
  const frozen = pileFrozenFor(state, playerIndex)
  const existing = existingOpenMeld(team, top.rank as MeldRank)
  if (frozen || state.config.takePileNeedsTwoNaturalsAlways) {
    if (naturals.length < 2) return { ok: false, error: `Need two ${top.rank}s to take the pile.` }
  } else if (naturals.length === 1 && existing) {
    /* ok — add top to existing */
  } else if (naturals.length === 1 && wilds.length >= 1) {
    /* ok — new mixed meld */
  } else if (naturals.length >= 2) {
    /* ok */
  } else {
    return { ok: false, error: 'Cannot take the pile with those cards.' }
  }
  const claiming = [...naturals, ...wilds, top]
  if (!existing) {
    const rank = inferMeldRank(claiming)
    if (!rank) return { ok: false, error: 'Those cards do not form a meld with the top card.' }
    const err = validateMeldCards(claiming, rank, state.config)
    if (err) return { ok: false, error: err }
  } else {
    const err = canAddCards(existing, [...naturals, ...wilds, top], state.config)
    if (err) return { ok: false, error: err }
  }
  if (!team.hasInitialMeld) {
    const count = claiming.reduce((n, c) => n + meldCountPoints(c), 0)
    const need = initialMeldMinimum(state.config, team.score, state.round)
    if (count < need) {
      return { ok: false, error: `Initial meld needs ${need}; this play is ${count}.` }
    }
  }
  return { ok: true }
}

function layClaim(state: MatchState, playerIndex: number, fromHand: Card[], top: Card): void {
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const rank = (top.rank === '2' || top.rank === 'JOKER' || top.rank === '3' ? inferMeldRank([...fromHand, top]) : top.rank) as MeldRank
  const existing = existingOpenMeld(team, rank)
  const cards = [...fromHand, top]
  if (existing) {
    existing.cards.push(...cards)
    const closed = closeIfNeeded(existing, state.config)
    existing.closed = closed.closed
  } else {
    const meld: Meld = closeIfNeeded({ rank, cards, closed: false }, state.config)
    team.melds.push(meld)
  }
  team.hasInitialMeld = true
  player.meldedThisHand = true
}

function endTurn(state: MatchState): void {
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length
  state.turnNumber++
  state.phase = 'awaitingDraw'
  state.lastMessage = `${state.players[state.currentPlayer]!.displayName}'s turn.`
}

function teamHasGoingOutBooks(state: MatchState, teamIndex: 0 | 1): boolean {
  const cfg = state.config
  const counts = teamCanastaCounts(state.teams[teamIndex]!.melds, cfg.canastaSize)
  if (cfg.variant === 'canasta') return counts.clean + counts.dirty + counts.wild >= 1
  const needC = cfg.house.goingOutClean
  const needD = cfg.house.goingOutDirty
  return counts.clean >= needC && counts.dirty + counts.wild >= needD
}

function canPlayerGoOut(state: MatchState, playerIndex: number): ApplyResult {
  const player = state.players[playerIndex]!
  const cfg = state.config
  if (cfg.footSize > 0 && !player.footPickedUp) {
    return { ok: false, error: 'Pick up your Foot before going out.' }
  }
  if (!teamHasGoingOutBooks(state, player.team)) {
    if (cfg.variant === 'canasta') return { ok: false, error: 'Your team needs a canasta to go out.' }
    return { ok: false, error: 'Your team does not have the required books to go out.' }
  }
  const partner = partnerOf(state, playerIndex)
  if (partner && cfg.footSize > 0 && !partner.footPickedUp) {
    return { ok: false, error: 'Your partner has not picked up their Foot.' }
  }
  return { ok: true }
}

function needsConsent(state: MatchState, playerIndex: number): boolean {
  const cfg = state.config
  if (!cfg.house.partnerConsent) return false
  if (cfg.variant !== 'handAndFoot') return false
  const partner = partnerOf(state, playerIndex)
  return Boolean(partner)
}

function finishRound(state: MatchState, wentOutPlayer: number): void {
  state.wentOutPlayer = wentOutPlayer
  const wentOutTeam = wentOutPlayer >= 0 ? state.players[wentOutPlayer]!.team : -1
  const b0 = scoreTeamHand(state, 0, wentOutTeam)
  const b1 = scoreTeamHand(state, 1, wentOutTeam)
  state.teams[0]!.score += b0.total
  state.teams[1]!.score += b1.total
  state.phase = 'roundEnd'
  const names = ['Us', 'Them']
  if (state.players.length === 4) {
    names[0] = `${state.players[0]!.displayName} / ${state.players[2]!.displayName}`
    names[1] = `${state.players[1]!.displayName} / ${state.players[3]!.displayName}`
  } else {
    names[0] = state.players[0]!.displayName
    names[1] = state.players[1]!.displayName
  }
  const out = wentOutPlayer >= 0 ? `${state.players[wentOutPlayer]!.displayName} went out. ` : 'Stock ran out. '
  state.lastMessage = `${out}${names[0]} ${b0.total >= 0 ? '+' : ''}${b0.total}, ${names[1]} ${b1.total >= 0 ? '+' : ''}${b1.total}.`
  const cfg = state.config
  if (cfg.playTo != null) {
    if (state.teams[0]!.score >= cfg.playTo || state.teams[1]!.score >= cfg.playTo) {
      finishMatch(state)
    }
  } else if (cfg.rounds != null && state.round >= cfg.rounds) {
    finishMatch(state)
  }
}

function finishMatch(state: MatchState): void {
  state.phase = 'matchEnd'
  if (state.teams[0]!.score > state.teams[1]!.score) state.winnerTeam = 0
  else if (state.teams[1]!.score > state.teams[0]!.score) state.winnerTeam = 1
  else state.winnerTeam = -1
  if (state.winnerTeam < 0) state.lastMessage += ' Tie game.'
  else {
    const t = state.winnerTeam
    const label = state.players.length === 2
      ? state.players[t]!.displayName
      : `${state.players[t]!.displayName} & ${state.players[t + 2]!.displayName}`
    state.lastMessage += ` ${label} win.`
  }
}

function applyDrawStock(state: MatchState, playerIndex: number): ApplyResult {
  if (state.phase !== 'awaitingDraw') return { ok: false, error: 'It is not time to draw.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  const need = state.config.stockDraw
  if (state.stock.length < need) {
    finishRound(state, -1)
    return { ok: true }
  }
  const player = state.players[playerIndex]!
  player.concealedEligible = !player.meldedThisHand
  for (let i = 0; i < need; i++) {
    const c = state.stock.shift()!
    player.hand.push(c)
  }
  flushRedThrees(state, playerIndex, state.config.redThreeReplacement)
  player.hand = sortHand(player.hand)
  state.phase = 'awaitingPlay'
  state.lastMessage = `${player.displayName} draws.`
  return { ok: true }
}

function applyTakePile(state: MatchState, playerIndex: number, cardIds: string[]): ApplyResult {
  const check = takePileLegal(state, playerIndex, cardIds)
  if (!check.ok) return check
  const player = state.players[playerIndex]!
  player.concealedEligible = !player.meldedThisHand
  const top = peekDiscard(state)!
  const { taken, rest } = takeCards(player.hand, cardIds)
  player.hand = rest
  const pile = state.discard
  const pileSize = pile.length
  state.discard = []
  state.discardFrozen = false
  layClaim(state, playerIndex, taken, top)
  const buried = pile.filter((c) => c.id !== top.id)
  player.hand.push(...buried)
  flushRedThrees(state, playerIndex, false)
  player.hand = sortHand(player.hand)
  state.phase = 'awaitingPlay'
  state.lastMessage = `${player.displayName} takes the pile (${pileSize}).`
  return { ok: true }
}

function applyMeld(state: MatchState, playerIndex: number, cardIds: string[]): ApplyResult {
  if (state.phase !== 'awaitingPlay') return { ok: false, error: 'Draw first.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const { taken, rest, missing } = takeCards(player.hand, cardIds)
  if (missing.length) return { ok: false, error: 'Those cards are not in your hand.' }
  const rank = inferMeldRank(taken)
  if (!rank) return { ok: false, error: 'Those cards are not a single rank.' }
  if (rank === '3') {
    const going = canPlayerGoOut(state, playerIndex)
    if (!going.ok) return { ok: false, error: 'Black threes can only be melded when going out.' }
    if (rest.length > 1) return { ok: false, error: 'Black threes are only melded as you go out.' }
  }
  const err = validateMeldCards(taken, rank, state.config)
  if (err) return { ok: false, error: err }
  if (rank === 'WILD' && !state.config.house.wildBooksAllowed) {
    return { ok: false, error: 'Wild books are not allowed.' }
  }
  if (!team.hasInitialMeld) {
    const count = taken.reduce((n, c) => n + meldCountPoints(c), 0)
    const need = initialMeldMinimum(state.config, team.score, state.round)
    if (count < need) return { ok: false, error: `Initial meld needs ${need}; this play is ${count}.` }
  }
  if (state.config.booksCloseAtSeven && taken.length === state.config.canastaSize) {
    const wilds = taken.filter((c) => isWild(c)).length
    const naturals = taken.length - wilds
    if (wilds > 0 && rank !== 'WILD' && naturals < state.config.minNaturalsForDirtyBook) {
      return { ok: false, error: 'A dirty book needs at least four natural cards.' }
    }
  }
  player.hand = rest
  const meld: Meld = closeIfNeeded({ rank, cards: taken, closed: false }, state.config)
  team.melds.push(meld)
  team.hasInitialMeld = true
  player.meldedThisHand = true
  const kind = canastaKind(meld, state.config.canastaSize)
  const stamp = kind === 'natural' ? 'Clean canasta!' : kind === 'mixed' ? 'Dirty canasta!' : kind === 'wild' ? 'Wild book!' : 'Meld laid.'
  state.lastMessage = `${player.displayName}: ${stamp}`
  maybePickupFoot(state, playerIndex, false)
  tryAutoGoOut(state, playerIndex)
  return { ok: true }
}

function applyAdd(state: MatchState, playerIndex: number, meldIndex: number, cardIds: string[]): ApplyResult {
  if (state.phase !== 'awaitingPlay') return { ok: false, error: 'Draw first.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const meld = team.melds[meldIndex]
  if (!meld) return { ok: false, error: 'No such meld.' }
  if (!team.hasInitialMeld) return { ok: false, error: 'Make your initial meld first.' }
  const { taken, rest, missing } = takeCards(player.hand, cardIds)
  if (missing.length) return { ok: false, error: 'Those cards are not in your hand.' }
  const err = canAddCards(meld, taken, state.config)
  if (err) return { ok: false, error: err }
  player.hand = rest
  meld.cards.push(...taken)
  const closed = closeIfNeeded(meld, state.config)
  meld.closed = closed.closed
  player.meldedThisHand = true
  const kind = canastaKind(meld, state.config.canastaSize)
  state.lastMessage =
    kind === 'natural' ? `${player.displayName} closes a clean book!` :
    kind === 'mixed' ? `${player.displayName} closes a dirty book!` :
    `${player.displayName} adds to the meld.`
  maybePickupFoot(state, playerIndex, false)
  tryAutoGoOut(state, playerIndex)
  return { ok: true }
}

function tryAutoGoOut(state: MatchState, playerIndex: number): void {
  const player = state.players[playerIndex]!
  if (player.hand.length > 0) return
  if (state.config.requireDiscardToGoOut) return
  const able = canPlayerGoOut(state, playerIndex)
  if (!able.ok) return
  if (needsConsent(state, playerIndex)) {
    state.pendingGoOut = { playerIndex, discardId: null }
    state.phase = 'awaitingGoOutConsent'
    const partner = partnerOf(state, playerIndex)
    state.lastMessage = `${player.displayName} asks ${partner?.displayName ?? 'partner'} — may I go out?`
    return
  }
  finishRound(state, playerIndex)
}

function applyDiscard(state: MatchState, playerIndex: number, cardId: string): ApplyResult {
  if (state.phase !== 'awaitingPlay') return { ok: false, error: 'Draw first.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  const player = state.players[playerIndex]!
  const card = findCard(player.hand, cardId)
  if (!card) return { ok: false, error: 'That card is not in your hand.' }
  if (isRedThree(card)) return { ok: false, error: 'Red threes are laid, not discarded.' }
  const goingOut = player.hand.length === 1
  if (goingOut) {
    const able = canPlayerGoOut(state, playerIndex)
    if (!able.ok) {
      if (state.config.footSize > 0 && !player.footPickedUp) {
        /* discarding last hand card picks up foot — not going out yet */
      } else {
        return able
      }
    } else if (needsConsent(state, playerIndex)) {
      state.pendingGoOut = { playerIndex, discardId: cardId }
      state.phase = 'awaitingGoOutConsent'
      const partner = partnerOf(state, playerIndex)
      state.lastMessage = `${player.displayName} asks ${partner?.displayName ?? 'partner'} — may I go out?`
      return { ok: true }
    }
  }
  const { rest } = takeCards(player.hand, [cardId])
  player.hand = rest
  state.discard.push(card)
  if (isWild(card) && state.config.freezeOnWildDiscard) state.discardFrozen = true
  if (goingOut && player.footPickedUp && canPlayerGoOut(state, playerIndex).ok) {
    finishRound(state, playerIndex)
    return { ok: true }
  }
  const footEndedTurn = maybePickupFoot(state, playerIndex, true)
  if (footEndedTurn) {
    endTurn(state)
    return { ok: true }
  }
  endTurn(state)
  return { ok: true }
}

function applyConsent(state: MatchState, playerIndex: number, accept: boolean): ApplyResult {
  if (state.phase !== 'awaitingGoOutConsent' || !state.pendingGoOut) {
    return { ok: false, error: 'No one asked to go out.' }
  }
  const pending = state.pendingGoOut
  const partner = partnerOf(state, pending.playerIndex)
  if (!partner || state.players.indexOf(partner) !== playerIndex) {
    return { ok: false, error: 'Only the partner can answer.' }
  }
  if (!accept) {
    state.pendingGoOut = null
    state.phase = 'awaitingPlay'
    state.currentPlayer = pending.playerIndex
    state.lastMessage = `${partner.displayName} says not yet.`
    return { ok: true }
  }
  const discardId = pending.discardId
  state.pendingGoOut = null
  if (discardId) {
    const player = state.players[pending.playerIndex]!
    const { rest, taken } = takeCards(player.hand, [discardId])
    if (taken[0]) {
      player.hand = rest
      state.discard.push(taken[0])
    }
  }
  finishRound(state, pending.playerIndex)
  return { ok: true }
}

export function tryApply(state: MatchState, move: GameMove, playerIndex?: number): ApplyResult {
  const who = playerIndex ?? state.currentPlayer
  if (state.phase === 'matchEnd') return { ok: false, error: 'The match is over.' }
  if (move.kind === 'continue') {
    if (state.phase !== 'roundEnd') return { ok: false, error: 'The hand is still going.' }
    state.round++
    resetHandKeepScores(state)
    return { ok: true }
  }
  if (move.kind === 'consentGoOut') return applyConsent(state, who, move.accept)
  switch (move.kind) {
    case 'drawStock':
      return applyDrawStock(state, who)
    case 'takePile':
      return applyTakePile(state, who, move.cardIds)
    case 'meld':
      return applyMeld(state, who, move.cardIds)
    case 'addToMeld':
      return applyAdd(state, who, move.meldIndex, move.cardIds)
    case 'discard':
      return applyDiscard(state, who, move.cardId)
    default:
      return { ok: false, error: 'Unknown move.' }
  }
}

export function getLegalMoves(state: MatchState, playerIndex: number): GameMove[] {
  const moves: GameMove[] = []
  if (state.phase === 'roundEnd') {
    moves.push({ kind: 'continue' })
    return moves
  }
  if (state.phase === 'awaitingGoOutConsent') {
    const partner = state.pendingGoOut ? partnerOf(state, state.pendingGoOut.playerIndex) : null
    if (partner && state.players.indexOf(partner) === playerIndex) {
      moves.push({ kind: 'consentGoOut', accept: true })
      moves.push({ kind: 'consentGoOut', accept: false })
    }
    return moves
  }
  if (playerIndex !== state.currentPlayer) return moves
  if (state.phase === 'awaitingDraw') {
    moves.push({ kind: 'drawStock' })
    const claim = claimCardsForPile(state, playerIndex)
    if (claim) moves.push({ kind: 'takePile', cardIds: claim })
    return moves
  }
  if (state.phase !== 'awaitingPlay') return moves
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const byRank = new Map<string, Card[]>()
  const wilds = player.hand.filter(isWild)
  for (const c of player.hand) {
    if (isWild(c) || isRedThree(c)) continue
    const list = byRank.get(c.rank) ?? []
    list.push(c)
    byRank.set(c.rank, list)
  }
  for (const [rank, cards] of byRank) {
    if (rank === '3') continue
    for (let w = 0; w <= Math.min(wilds.length, state.config.maxWildsPerMeld); w++) {
      const set = [...cards, ...wilds.slice(0, w)]
      if (set.length < 3) continue
      const probe = { ...cloneState(state) }
      const res = tryApply(probe, { kind: 'meld', cardIds: set.map((c) => c.id) }, playerIndex)
      if (res.ok) moves.push({ kind: 'meld', cardIds: set.map((c) => c.id) })
    }
    team.melds.forEach((m, meldIndex) => {
      if (m.rank !== rank && m.rank !== 'WILD') return
      const addable = m.rank === 'WILD' ? wilds : [...cards.filter((c) => c.rank === m.rank), ...wilds]
      if (!addable.length) return
      const probe = cloneState(state)
      const res = tryApply(probe, { kind: 'addToMeld', meldIndex, cardIds: [addable[0]!.id] }, playerIndex)
      if (res.ok) moves.push({ kind: 'addToMeld', meldIndex, cardIds: [addable[0]!.id] })
    })
  }
  if (wilds.length >= 3 && state.config.house.wildBooksAllowed) {
    const probe = cloneState(state)
    const ids = wilds.slice(0, Math.min(7, wilds.length)).map((c) => c.id)
    if (tryApply(probe, { kind: 'meld', cardIds: ids }, playerIndex).ok) {
      moves.push({ kind: 'meld', cardIds: ids })
    }
  }
  for (const c of player.hand) {
    const probe = cloneState(state)
    if (tryApply(probe, { kind: 'discard', cardId: c.id }, playerIndex).ok) {
      moves.push({ kind: 'discard', cardId: c.id })
    }
  }
  return moves
}

export function legalHandIndexes(state: MatchState, playerIndex: number): Set<number> {
  const player = state.players[playerIndex]
  const set = new Set<number>()
  if (!player) return set
  if (state.phase === 'awaitingDraw' && playerIndex === state.currentPlayer) {
    const claim = claimCardsForPile(state, playerIndex)
    if (claim) {
      player.hand.forEach((c, i) => {
        if (claim.includes(c.id)) set.add(i)
      })
    }
    return set
  }
  if (state.phase !== 'awaitingPlay' || playerIndex !== state.currentPlayer) return set
  const moves = getLegalMoves(state, playerIndex)
  const ids = new Set<string>()
  for (const m of moves) {
    if (m.kind === 'meld' || m.kind === 'addToMeld' || m.kind === 'takePile') {
      for (const id of m.cardIds) ids.add(id)
    }
    if (m.kind === 'discard') ids.add(m.cardId)
  }
  player.hand.forEach((c, i) => {
    if (ids.has(c.id)) set.add(i)
  })
  return set
}

export function selectedMeldPoints(cards: Card[]): number {
  return cards.reduce((n, c) => n + meldCountPoints(c), 0)
}

export function discardValue(card: Card): number {
  return cardPoints(card)
}

export function isMyDraw(state: MatchState, playerIndex: number): boolean {
  return state.phase === 'awaitingDraw' && state.currentPlayer === playerIndex
}

export function isMyPlay(state: MatchState, playerIndex: number): boolean {
  return state.phase === 'awaitingPlay' && state.currentPlayer === playerIndex
}

export { initialMeldMinimum, meldIsCanasta, teamCanastaCounts }
