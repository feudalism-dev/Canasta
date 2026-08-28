import {
  cardPoints,
  findCard,
  isBlackThree,
  isRedThree,
  isWild,
  meldCountPoints,
  rankLabel,
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
  meldAcceptsAdds,
  meldIsCanasta,
  partitionMeldCards,
  planOpeningMeldGroups,
  buildMeldFromPack,
  teamCanastaCounts,
  validateMeldCards,
  isSequenceMeld,
} from './melds'
import { partnerIndex, partnerOf, scoreTeamHand, isRedThreeMeld } from './score'
import {
  findSequenceRuns,
  sequenceAcceptsCard,
  sortSequenceCards,
  validateSequenceCards,
} from './sequences'
import { stockDrawCount, teamMeetsGoOutRule } from './sambaRules'
import { flushRedThrees, maybeAutoplayRedThreesFromHand, maybePickupFoot, resetHandKeepScores } from './state'
import type { ApplyResult, GameMove, MatchState, Meld, TeamState } from './types'
import { initialMeldMinimum } from './variants'
import { isHandAndFoot, isSambaFamily } from './houseRules'

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
  if (state.config.blockTakePileOnWildTop && isWild(top)) return true
  if (isSambaFamily(state.config.variant) && isRedThree(top)) return true
  return isWild(top) || isBlackThree(top)
}

export function pileFrozenFor(state: MatchState, playerIndex: number): boolean {
  if (state.config.takePileNeedsTwoNaturalsAlways) return true
  if (state.discardFrozen) return true
  const team = state.teams[state.players[playerIndex]!.team]!
  return !team.hasInitialMeld
}

function existingOpenMeld(team: TeamState, rank: MeldRank, config: MatchState['config']): Meld | undefined {
  if (config.allowMultipleGroupsSameRank) return undefined
  return team.melds.find((m) => !isSequenceMeld(m) && m.rank === rank && meldAcceptsAdds(m, config))
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
  const existing = existingOpenMeld(team, top.rank as MeldRank, state.config)
  if (frozen) {
    if (naturals.length < 2) return null
    return [naturals[0]!.id, naturals[1]!.id]
  }
  if (existing) {
    if (naturals.length >= 1) return [naturals[0]!.id]
    return []
  }
  if (naturals.length >= 2) return [naturals[0]!.id, naturals[1]!.id]
  if (naturals.length === 1 && wilds.length >= 1) return [naturals[0]!.id, wilds[0]!.id]
  return null
}

type PileTakeParts = {
  claimFromHand: Card[]
  extraMelds: Card[][]
  rest: Card[]
}

function groupExtraMelds(cards: Card[], config: MatchState['config']): { groups: Card[][]; error: string | null } {
  const wilds = cards.filter(isWild)
  const byRank = new Map<string, Card[]>()
  for (const c of cards) {
    if (isWild(c) || isRedThree(c)) continue
    const list = byRank.get(c.rank) ?? []
    list.push(c)
    byRank.set(c.rank, list)
  }
  const groups: Card[][] = []
  let wildLeft = [...wilds]
  for (const [, naturals] of byRank) {
    if (naturals.length >= 3) {
      groups.push([...naturals])
    } else if (naturals.length === 2 && wildLeft.length >= 1) {
      groups.push([...naturals, wildLeft.shift()!])
    } else if (naturals.length === 2) {
      return { groups: [], error: 'Need a third card or a wild for that extra meld.' }
    } else if (naturals.length === 1) {
      return { groups: [], error: 'Extra cards must be complete melds (at least three).' }
    }
  }
  if (wildLeft.length >= 3 && config.house.wildBooksAllowed) {
    groups.push(wildLeft)
    wildLeft = []
  }
  if (wildLeft.length) return { groups: [], error: 'Those extra wilds do not make a meld.' }
  for (const g of groups) {
    const rank = inferMeldRank(g)
    if (!rank) return { groups: [], error: 'Those extra cards are not a meld.' }
    const err = validateMeldCards(g, rank, config)
    if (err) return { groups: [], error: err }
  }
  return { groups, error: null }
}

function inspectPileTake(state: MatchState, playerIndex: number, cardIds: string[]): ApplyResult & { parts?: PileTakeParts } {
  if (state.phase !== 'awaitingDraw') return { ok: false, error: 'It is not time to draw.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  if (pileIsStopped(state)) return { ok: false, error: 'The discard pile cannot be taken.' }
  const top = peekDiscard(state)!
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const { taken, rest, missing } = takeCards(player.hand, cardIds)
  if (missing.length) return { ok: false, error: 'Those cards are not in your hand.' }
  const naturals = taken.filter((c) => c.rank === top.rank && !isWild(c))
  const wilds = taken.filter((c) => isWild(c))
  const others = taken.filter((c) => !naturals.includes(c) && !wilds.includes(c))
  const frozen = pileFrozenFor(state, playerIndex)
  const existing = existingOpenMeld(team, top.rank as MeldRank, state.config)
  if (frozen || state.config.takePileNeedsTwoNaturalsAlways) {
    if (naturals.length < 2) {
      return { ok: false, error: `Need two ${rankLabel(top.rank)}s to take the pile.` }
    }
  } else if (existing) {
    /* ok — add the top card to the existing unfrozen meld; matching cards from hand are optional */
  } else if (naturals.length === 1 && wilds.length >= 1) {
    /* ok — new mixed meld */
  } else if (naturals.length >= 2) {
    /* ok */
  } else {
    return { ok: false, error: `Need ${rankLabel(top.rank)}s to take the pile.` }
  }
  let claimWilds = [...wilds]
  let extraCards = [...others]
  let handRest = [...rest]
  if (team.hasInitialMeld) {
    extraCards = []
    claimWilds = naturals.length === 1 && !existing ? wilds.slice(0, 1) : []
    const unusedWilds = wilds.filter((c) => !claimWilds.includes(c))
    handRest.push(...others, ...unusedWilds)
  }
  const claimFromHand = [...naturals, ...claimWilds]
  const claiming = existing ? [...naturals, ...claimWilds, top] : [...claimFromHand, top]
  if (!existing) {
    const rank = inferMeldRank(claiming)
    if (!rank) return { ok: false, error: 'Those cards do not form a meld with the top card.' }
    const err = validateMeldCards(claiming, rank, state.config)
    if (err) return { ok: false, error: err }
  } else {
    const err = canAddCards(existing, [...naturals, ...claimWilds, top], state.config)
    if (err) return { ok: false, error: err }
  }
  const leftoverWilds = team.hasInitialMeld ? [] : wilds.filter((c) => !claimWilds.includes(c))
  const extraPack = [...extraCards, ...leftoverWilds]
  const grouped = extraPack.length ? groupExtraMelds(extraPack, state.config) : { groups: [] as Card[][], error: null }
  if (grouped.error) return { ok: false, error: grouped.error }
  if (!team.hasInitialMeld) {
    const laid = [...claiming, ...grouped.groups.flat()]
    const count = laid.reduce((n, c) => n + meldCountPoints(c), 0)
    const need = initialMeldMinimum(state.config, team.score, state.round)
    if (count < need) {
      return {
        ok: false,
        error: `Initial meld needs ${need}; ${rankLabel(top.rank)}s plus these cards are ${count}. Select more cards to put down, then click the pile.`,
      }
    }
  }
  return { ok: true, parts: { claimFromHand, extraMelds: grouped.groups, rest: handRest } }
}

function autoFillPileExtras(state: MatchState, playerIndex: number, claimIds: string[]): string[] | null {
  if (inspectPileTake(state, playerIndex, claimIds).ok) return claimIds
  const player = state.players[playerIndex]!
  const top = peekDiscard(state)
  if (!top) return null
  const used = new Set(claimIds)
  const ids = [...claimIds]
  const remaining = () => player.hand.filter((c) => !used.has(c.id))
  const keepIfProgress = (card: Card): boolean => {
    used.add(card.id)
    ids.push(card.id)
    const r = inspectPileTake(state, playerIndex, ids)
    if (r.ok) return true
    if (r.error.includes('Initial meld needs')) return false
    used.delete(card.id)
    ids.pop()
    return false
  }
  for (const c of remaining()) {
    if (c.rank === top.rank && !isWild(c) && keepIfProgress(c)) return ids
  }
  for (const c of remaining()) {
    if (isWild(c) && keepIfProgress(c)) return ids
  }
  const byRank = new Map<string, Card[]>()
  for (const c of remaining()) {
    if (isWild(c) || isRedThree(c) || c.rank === top.rank) continue
    const list = byRank.get(c.rank) ?? []
    list.push(c)
    byRank.set(c.rank, list)
  }
  const groups = [...byRank.values()]
    .filter((g) => g.length >= 3)
    .sort((a, b) => b.reduce((n, c) => n + meldCountPoints(c), 0) - a.reduce((n, c) => n + meldCountPoints(c), 0))
  for (const g of groups) {
    for (const c of g.slice(0, 3)) {
      used.add(c.id)
      ids.push(c.id)
    }
    if (inspectPileTake(state, playerIndex, ids).ok) return ids
    for (const c of g.slice(3)) {
      if (keepIfProgress(c)) return ids
    }
  }
  const pairs = [...byRank.values()].filter((g) => g.length === 2)
  const spareWilds = remaining().filter(isWild)
  for (const g of pairs) {
    if (!spareWilds.length) break
    const w = spareWilds.shift()!
    used.add(g[0]!.id)
    used.add(g[1]!.id)
    used.add(w.id)
    ids.push(g[0]!.id, g[1]!.id, w.id)
    if (inspectPileTake(state, playerIndex, ids).ok) return ids
  }
  return inspectPileTake(state, playerIndex, ids).ok ? ids : null
}

/** Hand cards to lay with the top discard. Adds extra melds from hand when the first meld is short. */
export function planPileTake(state: MatchState, playerIndex: number, preferIds: string[] = []): ApplyResult & { cardIds?: string[] } {
  const claim = claimCardsForPile(state, playerIndex)
  const top = peekDiscard(state)
  if (claim === null) {
    if (!top) return { ok: false, error: 'The discard pile is empty.' }
    if (pileIsStopped(state)) return { ok: false, error: 'The discard pile cannot be taken.' }
    if (pileFrozenFor(state, playerIndex)) {
      return { ok: false, error: `Need two ${rankLabel(top.rank)}s to take the frozen pile.` }
    }
    return { ok: false, error: `Need ${rankLabel(top.rank)}s to take the pile.` }
  }
  const preferred = preferIds.filter((id) => !claim.includes(id))
  if (preferred.length) {
    const withSel = [...claim, ...preferred]
    const sel = inspectPileTake(state, playerIndex, withSel)
    if (sel.ok) return { ok: true, cardIds: withSel }
  }
  const filled = autoFillPileExtras(state, playerIndex, claim)
  if (filled) return { ok: true, cardIds: filled }
  const fail = inspectPileTake(state, playerIndex, preferred.length ? [...claim, ...preferred] : claim)
  if (fail.ok) return { ok: true, cardIds: claim }
  return { ok: false, error: fail.error }
}

export function takePileLegal(state: MatchState, playerIndex: number, cardIds: string[]): ApplyResult {
  const check = inspectPileTake(state, playerIndex, cardIds)
  return check.ok ? { ok: true } : { ok: false, error: check.error }
}

function layClaim(state: MatchState, playerIndex: number, fromHand: Card[], top: Card): void {
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const rank = (top.rank === '2' || top.rank === 'JOKER' || top.rank === '3' ? inferMeldRank([...fromHand, top]) : top.rank) as MeldRank
  const existing = existingOpenMeld(team, rank, state.config)
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

function booksAllowGoingOut(state: MatchState, melds: Meld[]): boolean {
  return teamMeetsGoOutRule(melds, state.config)
}

function teamHasGoingOutBooks(state: MatchState, teamIndex: 0 | 1): boolean {
  return booksAllowGoingOut(state, state.teams[teamIndex]!.melds)
}

/** Cards that must stay in hand after a meld so the player can still discard (or go out). */
function minCardsToKeep(state: MatchState, playerIndex: number, meldsAfter: Meld[]): number {
  const player = state.players[playerIndex]!
  if (state.config.footSize > 0 && !player.footPickedUp) return 0
  const partner = partnerOf(state, playerIndex)
  const partnerFootOk = !(partner && state.config.footSize > 0 && !partner.footPickedUp)
  const canOut = booksAllowGoingOut(state, meldsAfter) && partnerFootOk
  if (canOut) {
    if (state.config.requireDiscardToGoOut) return 1
    return 0
  }
  return 2
}

function canPlayerGoOut(state: MatchState, playerIndex: number): ApplyResult {
  const player = state.players[playerIndex]!
  const cfg = state.config
  if (cfg.footSize > 0 && !player.footPickedUp) {
    return { ok: false, error: 'Pick up your Foot before going out.' }
  }
  if (!teamHasGoingOutBooks(state, player.team)) {
    if (cfg.goingOutRule === 'canasta') return { ok: false, error: 'Your team needs a canasta to go out.' }
    if (cfg.goingOutRule === 'samba') {
      return { ok: false, error: 'Need two sambas, two canastas, or one of each to go out.' }
    }
    if (cfg.goingOutRule === 'bolivia') {
      return { ok: false, error: 'Need two seven-card melds including at least one sequence to go out.' }
    }
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
  if (!isHandAndFoot(cfg.variant) && !isSambaFamily(cfg.variant)) return false
  const mate = partnerIndex(state, playerIndex)
  if (mate < 0) return false
  return state.players[mate]!.isHuman
}

/** True when going out requires a human partner's yes/no. */
export function needsPartnerGoOutConsent(state: MatchState, playerIndex: number): boolean {
  return needsConsent(state, playerIndex)
}

/** True when discarding this last card would ask the partner before ending the hand. */
export function discardNeedsGoOutConsent(state: MatchState, playerIndex: number, cardId: string): boolean {
  if (state.phase !== 'awaitingPlay' || playerIndex !== state.currentPlayer) return false
  if (!needsConsent(state, playerIndex)) return false
  const player = state.players[playerIndex]!
  if (player.hand.length !== 1) return false
  if (!findCard(player.hand, cardId)) return false
  if (state.config.footSize > 0 && !player.footPickedUp) return false
  return canPlayerGoOut(state, playerIndex).ok
}

/** Local player may ask a human partner before going out (one card to discard, or empty hand). */
export function readyToAskPartnerGoOut(state: MatchState, playerIndex: number): boolean {
  if (state.phase !== 'awaitingPlay' || playerIndex !== state.currentPlayer) return false
  if (!needsPartnerGoOutConsent(state, playerIndex)) return false
  if (!canPlayerGoOut(state, playerIndex).ok) return false
  const n = state.players[playerIndex]!.hand.length
  if (n === 0) return true
  if (n === 1 && state.config.requireDiscardToGoOut) return true
  return false
}

function beginGoOutConsent(state: MatchState, playerIndex: number, discardId: string | null): void {
  const mate = partnerIndex(state, playerIndex)
  if (mate < 0 || !state.players[mate]!.isHuman) {
    if (discardId) {
      const player = state.players[playerIndex]!
      const { rest, taken } = takeCards(player.hand, [discardId])
      if (taken[0]) {
        player.hand = rest
        state.discard.push(taken[0])
        if (isWild(taken[0]) && state.config.freezeOnWildDiscard) state.discardFrozen = true
        if (isRedThree(taken[0]) && state.config.house.redThreeDiscardFreezes) state.discardFrozen = true
      }
    }
    finishRound(state, playerIndex)
    return
  }
  const player = state.players[playerIndex]!
  state.pendingGoOut = { playerIndex, discardId }
  state.phase = 'awaitingGoOutConsent'
  const partner = partnerOf(state, playerIndex)
  state.lastMessage = `${player.displayName} asks ${partner?.displayName ?? 'partner'} — may I go out?`
}

function applyRequestGoOutConsent(state: MatchState, playerIndex: number): ApplyResult {
  if (state.phase !== 'awaitingPlay') return { ok: false, error: 'You cannot ask to go out right now.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  if (!needsConsent(state, playerIndex)) return { ok: false, error: 'Partner consent is not required.' }
  const able = canPlayerGoOut(state, playerIndex)
  if (!able.ok) return able
  const player = state.players[playerIndex]!
  if (player.hand.length > 1) {
    return {
      ok: false,
      error: 'Play down to your last card first, then ask your partner before you discard to go out.',
    }
  }
  const discardId = player.hand.length === 1 ? player.hand[0]!.id : null
  beginGoOutConsent(state, playerIndex, discardId)
  return { ok: true }
}

function finishRound(state: MatchState, wentOutPlayer: number): void {
  state.wentOutPlayer = wentOutPlayer
  state.pendingGoOut = null
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
  const need = stockDrawCount(state.config, state.stock.length)
  if (need === 0) {
    finishRound(state, -1)
    return { ok: true }
  }
  const player = state.players[playerIndex]!
  player.concealedEligible = !player.meldedThisHand
  for (let i = 0; i < need; i++) {
    const c = state.stock.shift()!
    player.hand.push(c)
  }
  maybeAutoplayRedThreesFromHand(state, playerIndex)
  player.hand = sortHand(player.hand)
  state.phase = 'awaitingPlay'
  state.lastMessage = `${player.displayName} draws.`
  return { ok: true }
}

function applyTakeSequenceTop(state: MatchState, playerIndex: number, meldIndex: number): ApplyResult {
  if (state.phase !== 'awaitingDraw') return { ok: false, error: 'It is not time to draw.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  if (pileIsStopped(state)) return { ok: false, error: 'The discard pile cannot be taken.' }
  const top = peekDiscard(state)
  if (!top) return { ok: false, error: 'The discard pile is empty.' }
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const meld = team.melds[meldIndex]
  if (!meld || !sequenceAcceptsCard(meld, top, state.config)) {
    return { ok: false, error: 'That card does not extend your sequence.' }
  }
  player.concealedEligible = !player.meldedThisHand
  state.discard.pop()
  meld.cards = sortSequenceCards([...meld.cards, top])
  const closed = closeIfNeeded(meld, state.config)
  meld.closed = closed.closed
  player.meldedThisHand = true
  state.phase = 'awaitingPlay'
  state.lastMessage = `${player.displayName} takes ${rankLabel(top.rank)} for the sequence.`
  return { ok: true }
}

function applyPass(state: MatchState, playerIndex: number): ApplyResult {
  if (state.phase !== 'awaitingPlay') return { ok: false, error: 'You cannot pass now.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  const player = state.players[playerIndex]!
  if (player.hand.length !== 1) return { ok: false, error: 'Pass only when one card remains and you cannot go out.' }
  if (canPlayerGoOut(state, playerIndex).ok) return { ok: false, error: 'You can go out — discard or meld out.' }
  endTurn(state)
  state.lastMessage = `${player.displayName} passes with one card.`
  return { ok: true }
}

function applyTakePile(state: MatchState, playerIndex: number, cardIds: string[]): ApplyResult {
  const check = inspectPileTake(state, playerIndex, cardIds)
  if (!check.ok || !check.parts) return check
  const player = state.players[playerIndex]!
  player.concealedEligible = !player.meldedThisHand
  const top = peekDiscard(state)!
  const { claimFromHand, extraMelds, rest } = check.parts
  player.hand = rest
  const pile = state.discard
  const topSeven = isHandAndFoot(state.config.variant) && state.config.house.takeDiscardTopSeven
  let takenPile: Card[]
  let leftPile: Card[]
  if (topSeven && pile.length > 7) {
    leftPile = pile.slice(0, pile.length - 7)
    takenPile = pile.slice(pile.length - 7)
  } else {
    leftPile = []
    takenPile = pile
  }
  const pileSize = takenPile.length
  state.discard = leftPile
  if (leftPile.length === 0) {
    state.discardFrozen = false
  } else {
    const newTop = leftPile[leftPile.length - 1]!
    state.discardFrozen = isWild(newTop) || isRedThree(newTop)
  }
  layClaim(state, playerIndex, claimFromHand, top)
  for (const cards of extraMelds) {
    const rank = inferMeldRank(cards)
    if (!rank) continue
    const meld: Meld = closeIfNeeded({ rank, cards, closed: false }, state.config)
    state.teams[player.team]!.melds.push(meld)
  }
  const buried = takenPile.filter((c) => c.id !== top.id)
  player.hand.push(...buried)
  // Classic Canasta: no replace from the pile. Hand and Foot: house autoplay/replace.
  if (isHandAndFoot(state.config.variant)) {
    maybeAutoplayRedThreesFromHand(state, playerIndex)
  } else {
    flushRedThrees(state, playerIndex, false)
  }
  player.hand = sortHand(player.hand)
  state.phase = 'awaitingPlay'
  state.lastMessage = `${player.displayName} takes the pile (${pileSize}).`
  return { ok: true }
}

function packsFromMeldMove(
  taken: Card[],
  groups: string[][] | undefined,
  config: MatchState['config'],
): { packs: Card[][]; error: string | null } {
  if (groups && groups.length) {
    const byId = new Map(taken.map((c) => [c.id, c]))
    const packs: Card[][] = []
    const seen = new Set<string>()
    for (const ids of groups) {
      if (!ids.length) continue
      const pack: Card[] = []
      for (const id of ids) {
        const card = byId.get(id)
        if (!card) return { packs: [], error: 'Those cards are not in your hand.' }
        if (seen.has(id)) return { packs: [], error: 'A card is in two sets.' }
        seen.add(id)
        pack.push(card)
      }
      packs.push(pack)
    }
    if (seen.size !== taken.length) return { packs: [], error: 'Select each card in only one set.' }
    for (const pack of packs) {
      if (config.redThreeMode === 'samba' && isRedThreeMeld(pack)) continue
      const built = buildMeldFromPack(pack, config)
      if (built.error) return { packs: [], error: built.error }
    }
    return { packs, error: null }
  }
  const split = partitionMeldCards(taken, config)
  return { packs: split.groups, error: split.error }
}

function openMeldOf(melds: Meld[], rank: MeldRank, config: MatchState['config']): Meld | undefined {
  if (config.allowMultipleGroupsSameRank) return undefined
  return melds.find((m) => !isSequenceMeld(m) && m.rank === rank && meldAcceptsAdds(m, config))
}

function previewMeldsAfterPacks(
  melds: Meld[],
  packs: Card[][],
  config: MatchState['config'],
): { next: Meld[]; error: string | null } {
  const next: Meld[] = melds.map((m) => ({ ...m, cards: [...m.cards] }))
  for (const pack of packs) {
    if (config.redThreeMode === 'samba' && isRedThreeMeld(pack)) {
      continue
    }
    const built = buildMeldFromPack(pack, config)
    if (built.error) return { next: [], error: built.error }
    const meld = built.meld
    if (isSequenceMeld(meld)) {
      next.push(meld)
      continue
    }
    const existing = openMeldOf(next, meld.rank, config)
    if (existing) {
      const err = canAddCards(existing, pack, config)
      if (err) return { next: [], error: err }
      existing.cards.push(...pack)
      const closed = closeIfNeeded(existing, config)
      existing.closed = closed.closed
    } else {
      next.push(meld)
    }
  }
  return { next, error: null }
}

function keepCardsError(state: MatchState, meldsAfter: Meld[]): string {
  if (state.config.requireDiscardToGoOut) {
    return 'Keep a card to discard — Hand and Foot goes out on a final discard.'
  }
  if (!booksAllowGoingOut(state, meldsAfter)) {
    return 'You need a canasta to go out. Add these to an existing pile, or keep cards to discard.'
  }
  return 'Keep enough cards to discard — you cannot go out yet.'
}

function applyMeld(state: MatchState, playerIndex: number, cardIds: string[], groups?: string[][]): ApplyResult {
  if (state.phase !== 'awaitingPlay') return { ok: false, error: 'Draw first.' }
  if (playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  const { taken, rest, missing } = takeCards(player.hand, cardIds)
  if (missing.length) return { ok: false, error: 'Those cards are not in your hand.' }
  const split = packsFromMeldMove(taken, groups, state.config)
  if (split.error) return { ok: false, error: split.error }
  const packs = split.packs
  if (!packs.length) return { ok: false, error: 'Select cards to meld.' }

  const redSingles = packs.filter((p) => state.config.redThreeMode === 'samba' && isRedThreeMeld(p))
  const meldPacks = packs.filter((p) => !redSingles.includes(p))

  for (const pack of meldPacks) {
    const built = buildMeldFromPack(pack, state.config)
    if (built.error) return { ok: false, error: built.error }
    if (isSequenceMeld(built.meld)) continue
    const rank = inferMeldRank(pack)
    if (rank === '3') {
      const going = canPlayerGoOut(state, playerIndex)
      if (!going.ok) return { ok: false, error: 'Black threes can only be melded when going out.' }
      if (rest.length > 1) return { ok: false, error: 'Black threes are only melded as you go out.' }
    }
    if (rank === 'WILD' && !state.config.house.wildBooksAllowed) {
      return { ok: false, error: 'Wild books are not allowed.' }
    }
  }
  if (!team.hasInitialMeld) {
    const count = taken.reduce((n, c) => n + meldCountPoints(c), 0)
    const need = initialMeldMinimum(state.config, team.score, state.round)
    if (count < need) return { ok: false, error: `Initial meld needs ${need}; these sets are ${count}.` }
  }
  const preview = previewMeldsAfterPacks(team.melds, meldPacks, state.config)
  if (preview.error) return { ok: false, error: preview.error }
  const keep = minCardsToKeep(state, playerIndex, preview.next)
  if (rest.length < keep) {
    return { ok: false, error: keepCardsError(state, preview.next) }
  }
  player.hand = rest
  team.melds = preview.next
  for (const r of redSingles) team.redThrees.push(r[0]!)
  team.hasInitialMeld = true
  player.meldedThisHand = true
  if (redSingles.length && !meldPacks.length) {
    state.lastMessage = `${player.displayName} melds ${redSingles.length} red three(s).`
  } else if (meldPacks.length === 1) {
    const built = buildMeldFromPack(meldPacks[0]!, state.config)
    const meld = built.meld
    if (isSequenceMeld(meld)) {
      state.lastMessage =
        meld.closed ? `${player.displayName}: Samba!` : `${player.displayName} starts a sequence.`
    } else {
      const kind = canastaKind(meld, state.config.canastaSize)
      const stamp =
        kind === 'natural'
          ? 'Clean canasta!'
          : kind === 'mixed'
            ? 'Dirty canasta!'
            : kind === 'wild'
              ? state.config.goingOutRule === 'bolivia'
                ? 'Bolivia!'
                : 'Wild book!'
              : 'Meld laid.'
      state.lastMessage = `${player.displayName}: ${stamp}`
    }
  } else {
    state.lastMessage = `${player.displayName} lays ${packs.length} melds.`
  }
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
  const nextMelds = team.melds.map((m, i) =>
    i === meldIndex ? { ...m, cards: [...m.cards, ...taken] } : m,
  )
  const keep = minCardsToKeep(state, playerIndex, nextMelds)
  if (rest.length < keep) {
    return { ok: false, error: keepCardsError(state, nextMelds) }
  }
  player.hand = rest
  if (isSequenceMeld(meld)) {
    meld.cards = sortSequenceCards([...meld.cards, ...taken])
  } else {
    meld.cards.push(...taken)
  }
  const closed = closeIfNeeded(meld, state.config)
  meld.closed = closed.closed
  player.meldedThisHand = true
  const kind = isSequenceMeld(meld)
    ? meld.closed
      ? 'samba'
      : 'none'
    : canastaKind(meld, state.config.canastaSize)
  state.lastMessage =
    kind === 'samba'
      ? `${player.displayName} completes a samba!`
      : kind === 'natural'
        ? `${player.displayName} closes a clean book!`
        : kind === 'mixed'
          ? `${player.displayName} closes a dirty book!`
          : kind === 'wild'
            ? state.config.goingOutRule === 'bolivia'
              ? `${player.displayName} completes a Bolivia!`
              : `${player.displayName} closes a wild book!`
            : `${player.displayName} adds to the meld.`
  maybePickupFoot(state, playerIndex, false)
  tryAutoGoOut(state, playerIndex)
  return { ok: true }
}

/** When the hand is empty and books allow going out: finish, or ask partner if requested. */
function tryAutoGoOut(state: MatchState, playerIndex: number, requestConsent = false): void {
  const player = state.players[playerIndex]!
  if (player.hand.length > 0) return
  if (state.phase !== 'awaitingPlay' && state.phase !== 'awaitingGoOutConsent') return
  const able = canPlayerGoOut(state, playerIndex)
  if (!able.ok) return
  if (needsConsent(state, playerIndex)) {
    if (!requestConsent) {
      const partner = partnerOf(state, playerIndex)
      state.lastMessage = `${player.displayName} is ready to go out — ask ${partner?.displayName ?? 'your partner'} for permission.`
      return
    }
    beginGoOutConsent(state, playerIndex, null)
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
  if (isRedThree(card) && state.config.house.autoplayRedThreesOnDraw) {
    return { ok: false, error: 'Red threes are laid, not discarded.' }
  }
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
      beginGoOutConsent(state, playerIndex, cardId)
      return { ok: true }
    }
  }
  const { rest } = takeCards(player.hand, [cardId])
  player.hand = rest
  state.discard.push(card)
  if (isWild(card) && state.config.freezeOnWildDiscard) state.discardFrozen = true
  if (isRedThree(card) && state.config.house.redThreeDiscardFreezes) state.discardFrozen = true
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
  const mate = partnerIndex(state, pending.playerIndex)
  if (mate !== playerIndex) {
    return { ok: false, error: 'Only the partner can answer.' }
  }
  const partner = state.players[mate]!
  if (!accept) {
    if (!pending.discardId) {
      finishRound(state, pending.playerIndex)
      return { ok: true }
    }
    state.pendingGoOut = null
    const whoSaidNo = partner.displayName
    endTurn(state)
    state.lastMessage = `${whoSaidNo} says not yet. ${state.players[state.currentPlayer]!.displayName}'s turn.`
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
  if (move.kind === 'requestGoOutConsent') return applyRequestGoOutConsent(state, who)
  if (move.kind === 'goOut') {
    if (state.phase !== 'awaitingPlay') return { ok: false, error: 'You cannot go out right now.' }
    if (who !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
    maybePickupFoot(state, who, false)
    tryAutoGoOut(state, who, true)
    if (state.phase === 'awaitingPlay' && state.players[who]!.hand.length === 0) {
      const able = canPlayerGoOut(state, who)
      if (!able.ok) return { ok: false, error: able.error }
      return { ok: false, error: 'Ask your partner before going out.' }
    }
    return { ok: true }
  }
  switch (move.kind) {
    case 'drawStock':
      return applyDrawStock(state, who)
    case 'takePile':
      return applyTakePile(state, who, move.cardIds)
    case 'takeSequenceTop':
      return applyTakeSequenceTop(state, who, move.meldIndex)
    case 'pass':
      return applyPass(state, who)
    case 'meld':
      return applyMeld(state, who, move.cardIds, move.groups)
    case 'addToMeld':
      return applyAdd(state, who, move.meldIndex, move.cardIds)
    case 'discard':
      return applyDiscard(state, who, move.cardId)
    default:
      return { ok: false, error: 'Unknown move.' }
  }
}

export function forcePass(state: MatchState): ApplyResult {
  if (state.phase === 'awaitingDraw') {
    return applyDrawStock(state, state.currentPlayer)
  }
  if (state.phase !== 'awaitingPlay') return { ok: false, error: 'Cannot pass now.' }
  const who = state.currentPlayer
  const name = state.players[who]!.displayName
  endTurn(state)
  state.lastMessage = `${name} has no legal play and passes.`
  return { ok: true }
}

export function discardIsLegal(state: MatchState, playerIndex: number, cardId: string): boolean {
  if (state.phase !== 'awaitingPlay' || playerIndex !== state.currentPlayer) return false
  const player = state.players[playerIndex]!
  const card = findCard(player.hand, cardId)
  if (!card) return false
  if (isRedThree(card) && state.config.house.autoplayRedThreesOnDraw) return false
  if (player.hand.length > 1) return true
  if (state.config.footSize > 0 && !player.footPickedUp) return true
  return canPlayerGoOut(state, playerIndex).ok
}

export function getLegalMoves(state: MatchState, playerIndex: number): GameMove[] {
  const moves: GameMove[] = []
  if (state.phase === 'roundEnd') {
    moves.push({ kind: 'continue' })
    return moves
  }
  if (state.phase === 'awaitingGoOutConsent') {
    const mate = state.pendingGoOut ? partnerIndex(state, state.pendingGoOut.playerIndex) : -1
    if (mate === playerIndex) {
      moves.push({ kind: 'consentGoOut', accept: true })
      moves.push({ kind: 'consentGoOut', accept: false })
    }
    return moves
  }
  if (playerIndex !== state.currentPlayer) return moves
  if (state.phase === 'awaitingDraw') {
    moves.push({ kind: 'drawStock' })
    const plan = planPileTake(state, playerIndex)
    if (plan.ok && plan.cardIds !== undefined) moves.push({ kind: 'takePile', cardIds: plan.cardIds })
    const top = peekDiscard(state)
    if (top && !pileIsStopped(state) && state.config.sequencesEnabled) {
      const drawTeam = state.teams[state.players[playerIndex]!.team]!
      drawTeam.melds.forEach((m, meldIndex) => {
        if (sequenceAcceptsCard(m, top, state.config)) {
          moves.push({ kind: 'takeSequenceTop', meldIndex })
        }
      })
    }
    return moves
  }
  if (state.phase !== 'awaitingPlay') return moves
  const player = state.players[playerIndex]!
  const team = state.teams[player.team]!
  if (readyToAskPartnerGoOut(state, playerIndex)) {
    moves.push({ kind: 'requestGoOutConsent' })
  }
  if (player.hand.length === 0) {
    moves.push({ kind: 'goOut' })
    return moves
  }
  if (!team.hasInitialMeld) {
    const need = initialMeldMinimum(state.config, team.score, state.round)
    const opening = planOpeningMeldGroups(player.hand, state.config, need)
    if (opening) {
      const groups = opening.map((g) => g.map((c) => c.id))
      moves.push({ kind: 'meld', cardIds: groups.flat(), groups })
    }
  }
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
    const maxW = Math.min(wilds.length, state.config.maxWildsPerMeld)
    for (let w = 0; w <= maxW; w++) {
      const set = [...cards, ...wilds.slice(0, w)]
      if (set.length < 3) continue
      const inferred = inferMeldRank(set)
      if (!inferred) continue
      if (validateMeldCards(set, inferred, state.config)) continue
      if (!team.hasInitialMeld) {
        const count = set.reduce((n, c) => n + meldCountPoints(c), 0)
        if (count < initialMeldMinimum(state.config, team.score, state.round)) continue
      }
      const preview = previewMeldsAfterPacks(team.melds, [set], state.config)
      if (preview.error) continue
      const restLen = player.hand.length - set.length
      if (restLen < minCardsToKeep(state, playerIndex, preview.next)) continue
      moves.push({ kind: 'meld', cardIds: set.map((c) => c.id) })
    }
    team.melds.forEach((m, meldIndex) => {
      if (m.rank !== rank && m.rank !== 'WILD') return
      const addable = m.rank === 'WILD' ? wilds : [...cards.filter((c) => c.rank === m.rank), ...wilds]
      if (!addable.length) return
      const add: Card[] = []
      for (const c of addable) {
        const trial = [...add, c]
        if (canAddCards(m, trial, state.config)) break
        const nextMelds = team.melds.map((mm, i) =>
          i === meldIndex ? { ...mm, cards: [...mm.cards, ...trial] } : mm,
        )
        if (player.hand.length - trial.length < minCardsToKeep(state, playerIndex, nextMelds)) break
        add.push(c)
      }
      if (!add.length) return
      moves.push({ kind: 'addToMeld', meldIndex, cardIds: add.map((c) => c.id) })
    })
  }
  if (wilds.length >= 3 && state.config.house.wildBooksAllowed) {
    const ids = wilds.slice(0, Math.min(7, wilds.length)).map((c) => c.id)
    const set = wilds.slice(0, Math.min(7, wilds.length))
    if (!validateMeldCards(set, 'WILD', state.config)) {
      const restLen = player.hand.length - set.length
      const preview = previewMeldsAfterPacks(team.melds, [set], state.config)
      if (!preview.error && restLen >= minCardsToKeep(state, playerIndex, preview.next)) {
        moves.push({ kind: 'meld', cardIds: ids })
      }
    }
  }
  if (state.config.sequencesEnabled) {
    for (const run of findSequenceRuns(player.hand)) {
      if (validateSequenceCards(run, state.config)) continue
      if (!team.hasInitialMeld) {
        const count = run.reduce((n, c) => n + meldCountPoints(c), 0)
        if (count < initialMeldMinimum(state.config, team.score, state.round)) continue
      }
      const preview = previewMeldsAfterPacks(team.melds, [run], state.config)
      if (preview.error) continue
      if (player.hand.length - run.length < minCardsToKeep(state, playerIndex, preview.next)) continue
      moves.push({ kind: 'meld', cardIds: run.map((c) => c.id) })
    }
    team.melds.forEach((m, meldIndex) => {
      if (!isSequenceMeld(m) || m.closed) return
      for (const c of player.hand) {
        if (!sequenceAcceptsCard(m, c, state.config)) continue
        const trial = sortSequenceCards([...m.cards, c])
        const preview = team.melds.map((mm, i) =>
          i === meldIndex ? { ...mm, cards: trial } : mm,
        )
        if (player.hand.length - 1 < minCardsToKeep(state, playerIndex, preview)) continue
        moves.push({ kind: 'addToMeld', meldIndex, cardIds: [c.id] })
      }
    })
  }
  if (state.config.redThreeMode === 'samba') {
    for (const c of player.hand) {
      if (!isRedThree(c)) continue
      const preview = previewMeldsAfterPacks(team.melds, [], state.config)
      if (player.hand.length - 1 < minCardsToKeep(state, playerIndex, preview.next)) continue
      moves.push({ kind: 'meld', cardIds: [c.id] })
    }
  }
  for (const c of player.hand) {
    if (discardIsLegal(state, playerIndex, c.id)) moves.push({ kind: 'discard', cardId: c.id })
  }
  if (
    isSambaFamily(state.config.variant) &&
    player.hand.length === 1 &&
    !canPlayerGoOut(state, playerIndex).ok
  ) {
    moves.push({ kind: 'pass' })
  }
  return moves
}

export function legalHandIndexes(state: MatchState, playerIndex: number): Set<number> {
  const player = state.players[playerIndex]
  const set = new Set<number>()
  if (!player) return set
  if (state.phase === 'awaitingDraw' && playerIndex === state.currentPlayer) {
    const plan = planPileTake(state, playerIndex)
    if (plan.ok && plan.cardIds !== undefined) {
      player.hand.forEach((c, i) => {
        if (plan.cardIds!.includes(c.id)) set.add(i)
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
