import { cardLabel, sortHand } from './deck'
import { buildResolveSteps } from './resolve'
import {
  ACTION_TIMEOUT_MS,
  cloneRowShamBo,
  dealNewGame,
  drawUpToFive,
  passTargetSeat,
  startRound,
} from './state'
import { directionLabel } from './variants'
import type { RowShamBoMove, RowShamBoState } from './types'

export type RowShamBoApplyResult =
  | { ok: true; state: RowShamBoState }
  | { ok: false; error: string }

/** Strip unrevealed table-play kinds so clients cannot peek ahead of duels. */
export function sanitizeRowShamBoForWire(state: RowShamBoState): RowShamBoState {
  const next = cloneRowShamBo(state)
  next.tablePlays = next.tablePlays.map((c, i) => {
    if (!c || next.revealed[i]) return c
    // Dummy kind — UI must honor `revealed[i]` and show the card back.
    return { id: c.id, kind: 'rock' }
  })
  return next
}

function allPassed(state: RowShamBoState): boolean {
  return state.players.every((p) => p.hand.length === 0 || p.passCardId != null)
}

function allPlayed(state: RowShamBoState): boolean {
  return state.players.every((p) => p.hand.length === 0 || p.playCardId != null)
}

function exchangePasses(state: RowShamBoState): void {
  const dir = state.direction!
  const n = state.players.length
  const outgoing = state.players.map((p) => {
    if (!p.passCardId) return null
    const card = p.hand.find((c) => c.id === p.passCardId) ?? null
    return card
  })
  for (let i = 0; i < n; i++) {
    const pl = state.players[i]!
    if (!pl.passCardId) continue
    pl.hand = pl.hand.filter((c) => c.id !== pl.passCardId)
  }
  for (const pl of state.players) pl.receivedCardId = null
  for (let i = 0; i < n; i++) {
    const card = outgoing[i]
    if (!card) continue
    const to = passTargetSeat(i, n, dir)
    const dest = state.players[to]!
    dest.hand = sortHand([...dest.hand, card])
    dest.receivedCardId = card.id
  }
  for (const pl of state.players) pl.passCardId = null
  state.passedThisGame = true
  if (state.handNumber < 1) state.handNumber = 1
}

function beginPassPhase(state: RowShamBoState): void {
  drawUpToFive(state)
  state.phase = 'pass'
  state.actionDeadline = Date.now() + ACTION_TIMEOUT_MS
  state.lastMessage = `Once this game — pass 1 card ${directionLabel(state.direction!)}.`
}

function beginPlayPhase(state: RowShamBoState): void {
  state.phase = 'play'
  state.actionDeadline = Date.now() + ACTION_TIMEOUT_MS
  const got = state.players
    .filter((p) => p.receivedCardId)
    .map((p) => {
      const card = p.hand.find((c) => c.id === p.receivedCardId)
      return card ? `${p.name} got ${cardLabel(card)}` : null
    })
    .filter(Boolean)
  state.lastMessage = got.length
    ? `Pass done — ${got.join('; ')}. Select a card to play.`
    : 'Select a card to play face-down.'
  state.log.push(state.lastMessage)
}

/** Lock plays face-down; flip + score only as each duel step runs. */
function beginReveal(state: RowShamBoState): void {
  state.actionDeadline = null
  const plays = state.players.map((p) => {
    if (!p.playCardId) return null
    return p.hand.find((c) => c.id === p.playCardId) ?? null
  })

  // Pull cards off hands onto the table (still face-down).
  state.tablePlays = plays.map((c) => (c ? { ...c } : null))
  state.revealed = state.players.map(() => false)
  for (let i = 0; i < state.players.length; i++) {
    const pl = state.players[i]!
    if (!pl.playCardId) continue
    pl.hand = sortHand(pl.hand.filter((c) => c.id !== pl.playCardId))
    pl.playCardId = null
  }

  const { steps } = buildResolveSteps(
    state.tablePlays,
    state.button,
    state.direction!,
    state.config.variant,
  )
  state.resolveSteps = steps
  state.resolveStepIndex = steps.length ? 0 : -1

  if (!steps.length) {
    sweepTableToDiscard(state)
    finishHand(state)
    return
  }

  // Start on a beat with all cards face-down; first ackResolve flips duel 1.
  state.phase = 'resolve'
  state.resolveStepIndex = -1
  state.lastMessage = 'Cards are down — get ready…'
  state.log.push(state.lastMessage)
}

function revealSeats(state: RowShamBoState, seats: number[]): void {
  for (const i of seats) {
    if (i >= 0 && i < state.revealed.length) state.revealed[i] = true
  }
}

function applyCurrentDuel(state: RowShamBoState): void {
  const step = state.resolveSteps[state.resolveStepIndex]
  if (!step) return

  // Flip only the cards in this duel (contested group + challenger).
  revealSeats(state, [...step.contested, step.next])

  for (const d of step.deltas) {
    const pl = state.players[d.seat]
    if (pl) pl.gameScore += d.delta
  }

  const names = (idxs: number[]) =>
    idxs.map((i) => state.players[i]?.name ?? `P${i + 1}`).join(' & ')
  const nextCard = state.tablePlays[step.next]
  const champCard = state.tablePlays[step.contested[0]!]
  const nextLabel = nextCard ? cardLabel(nextCard) : '?'
  const champLabel = champCard ? cardLabel(champCard) : '?'

  if (step.outcome === 'tie') {
    state.lastMessage = `TIE! ${names(step.contested)} — ${champLabel}`
  } else if (step.outcome === 'contestedWin') {
    state.lastMessage = `POW! ${names(step.contested)} (${champLabel}) beat ${names([step.next])} (${nextLabel})`
  } else {
    state.lastMessage = `POW! ${names([step.next])} (${nextLabel}) beat ${names(step.contested)} (${champLabel})`
  }
  state.log.push(state.lastMessage)
}

function sweepTableToDiscard(state: RowShamBoState): void {
  for (const c of state.tablePlays) {
    if (c) state.discard.push(c)
  }
  state.tablePlays = state.players.map(() => null)
  state.revealed = state.players.map(() => false)
}

function advanceResolve(state: RowShamBoState): void {
  const i = state.resolveStepIndex + 1
  if (i >= state.resolveSteps.length) {
    sweepTableToDiscard(state)
    finishHand(state)
    return
  }
  state.resolveStepIndex = i
  applyCurrentDuel(state)
}

function finishHand(state: RowShamBoState): void {
  state.phase = 'handEnd'
  state.actionDeadline = null
  state.resolveStepIndex = -1
  state.resolveSteps = []
  state.lastHandScores = state.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    delta: 0,
    gameTotal: p.gameScore,
    matchTotal: p.matchScore,
  }))
  // Rotate button clockwise
  state.button = (state.button + 1) % state.players.length

  const cardsLeft = state.players.reduce((s, p) => s + p.hand.length, 0)
  if (state.stock.length === 0 && cardsLeft === 0) {
    endGame(state)
    return
  }
  state.lastMessage = 'Round over…'
}

function endGame(state: RowShamBoState): void {
  state.phase = 'gameEnd'
  const ranked = [...state.players].sort((a, b) => b.gameScore - a.gameScore)
  const top = ranked[0]!
  state.lastMessage = `${top.name} wins the game with ${top.gameScore} pts!`
  state.log.push(state.lastMessage)

  // Add game scores into match
  for (const pl of state.players) {
    pl.matchScore += pl.gameScore
  }
  state.lastHandScores = state.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    delta: p.gameScore,
    gameTotal: p.gameScore,
    matchTotal: p.matchScore,
  }))

  const target = state.config.playTo
  const atTarget = state.players.filter((p) => p.matchScore >= target)
  if (atTarget.length) {
    atTarget.sort((a, b) => b.matchScore - a.matchScore)
    const best = atTarget[0]!.matchScore
    const champs = atTarget.filter((p) => p.matchScore === best)
    state.phase = 'matchEnd'
    if (champs.length > 1) {
      state.matchTied = true
      state.winnerId = null
      state.lastMessage = `Match tie at ${best}! ${champs.map((c) => c.name).join(' & ')}`
    } else {
      state.matchTied = false
      state.winnerId = champs[0]!.id
      state.lastMessage = `${champs[0]!.name} wins the match with ${best} pts!`
    }
    state.log.push(state.lastMessage)
  }
}

function autoPickCard(hand: { id: string }[]): string | null {
  if (!hand.length) return null
  return hand[Math.floor(Math.random() * hand.length)]!.id
}

function applyTimeout(state: RowShamBoState): RowShamBoState {
  const next = cloneRowShamBo(state)
  if (next.phase !== 'pass' && next.phase !== 'play') return next
  const t = Date.now()
  const dl = next.actionDeadline
  // Missing / invalid deadline — arm a full window; never pick.
  if (dl == null || !Number.isFinite(dl)) {
    next.actionDeadline = t + ACTION_TIMEOUT_MS
    return next
  }
  // Premature timeout (deadline still in the future) — ignore; never auto-pick early.
  if (t < dl) return next

  if (next.phase === 'pass') {
    for (const pl of next.players) {
      if (pl.passCardId || !pl.hand.length) continue
      if (!pl.isComputer) {
        pl.passCardId = autoPickCard(pl.hand)
        next.log.push(`${pl.name} timed out — random pass.`)
      }
    }
    if (allPassed(next)) {
      exchangePasses(next)
      beginPlayPhase(next)
    }
    return next
  }
  for (const pl of next.players) {
    if (pl.playCardId || !pl.hand.length) continue
    if (!pl.isComputer) {
      pl.playCardId = autoPickCard(pl.hand)
      pl.receivedCardId = null
      next.log.push(`${pl.name} timed out — random play.`)
    }
  }
  if (allPlayed(next)) beginReveal(next)
  return next
}

export function applyRowShamBoMove(state: RowShamBoState, move: RowShamBoMove): RowShamBoApplyResult {
  if (state.phase === 'matchEnd') return { ok: false, error: 'Match is over' }

  if (move.t === 'timeout') {
    return { ok: true, state: applyTimeout(state) }
  }

  const next = cloneRowShamBo(state)

  if (move.t === 'ackDir') {
    if (next.phase !== 'chooseDir') return { ok: false, error: 'Not choosing direction' }
    // Turn 1 of a game: pass once. Later rounds: direction was re-rolled for fights only.
    if (!next.passedThisGame) {
      beginPassPhase(next)
    } else {
      drawUpToFive(next)
      if (next.handNumber < 1) next.handNumber = 1
      beginPlayPhase(next)
      next.lastMessage = `Round ${next.handNumber} — ${directionLabel(next.direction!)}. Select a card to play face-down.`
    }
    return { ok: true, state: next }
  }

  if (move.t === 'pass') {
    if (next.phase !== 'pass') return { ok: false, error: 'Not pass phase' }
    // Find human or any player who owns the card and hasn't passed
    const pl = next.players.find((p) => p.hand.some((c) => c.id === move.cardId) && !p.passCardId)
    if (!pl) return { ok: false, error: 'Card not available' }
    if (!pl.hand.some((c) => c.id === move.cardId)) return { ok: false, error: 'Not in hand' }
    pl.passCardId = move.cardId
    next.log.push(`${pl.name} passes a card.`)
    // Auto-pass for bots after human acts (solo flow); peer will submit bot moves separately
    for (const bot of next.players) {
      if (!bot.isComputer || bot.passCardId || !bot.hand.length) continue
      bot.passCardId = autoPickCard(bot.hand)
    }
    if (allPassed(next)) {
      exchangePasses(next)
      beginPlayPhase(next)
    }
    return { ok: true, state: next }
  }

  if (move.t === 'play') {
    if (next.phase !== 'play') return { ok: false, error: 'Not play phase' }
    const pl = next.players.find((p) => p.hand.some((c) => c.id === move.cardId) && !p.playCardId)
    if (!pl) return { ok: false, error: 'Card not available' }
    pl.playCardId = move.cardId
    pl.receivedCardId = null
    next.log.push(`${pl.name} plays face-down.`)
    for (const bot of next.players) {
      if (!bot.isComputer || bot.playCardId || !bot.hand.length) continue
      bot.playCardId = autoPickCard(bot.hand)
      bot.receivedCardId = null
    }
    if (allPlayed(next)) beginReveal(next)
    return { ok: true, state: next }
  }

  if (move.t === 'ackReveal' || move.t === 'ackResolve') {
    if (next.phase !== 'resolve') return { ok: false, error: 'Not resolving' }
    advanceResolve(next)
    return { ok: true, state: next }
  }

  if (move.t === 'ackHandEnd') {
    if (next.phase !== 'handEnd') return { ok: false, error: 'Hand not over' }
    // Same game: re-roll fight direction; pass already done for this game.
    return { ok: true, state: startRound(next, Date.now() % 1e9) }
  }

  if (move.t === 'ackGameEnd') {
    if (next.phase !== 'gameEnd') return { ok: false, error: 'Game not over' }
    next.gameNumber += 1
    return { ok: true, state: dealNewGame(next, Date.now() % 1e9) }
  }

  return { ok: false, error: 'Unknown move' }
}

/** Submit pass/play for a specific seat (multiplayer). */
export function applyRowShamBoSeatMove(
  state: RowShamBoState,
  seat: number,
  move: Extract<RowShamBoMove, { t: 'pass' | 'play' }>,
): RowShamBoApplyResult {
  if (state.phase === 'matchEnd') return { ok: false, error: 'Match is over' }
  const next = cloneRowShamBo(state)
  const pl = next.players[seat]
  if (!pl) return { ok: false, error: 'Bad seat' }

  if (move.t === 'pass') {
    if (next.phase !== 'pass') return { ok: false, error: 'Not pass phase' }
    if (pl.passCardId) return { ok: false, error: 'Already passed' }
    if (!pl.hand.some((c) => c.id === move.cardId)) return { ok: false, error: 'Not in hand' }
    pl.passCardId = move.cardId
    if (allPassed(next)) {
      exchangePasses(next)
      beginPlayPhase(next)
    }
    return { ok: true, state: next }
  }

  if (next.phase !== 'play') return { ok: false, error: 'Not play phase' }
  if (pl.playCardId) return { ok: false, error: 'Already played' }
  if (!pl.hand.some((c) => c.id === move.cardId)) return { ok: false, error: 'Not in hand' }
  pl.playCardId = move.cardId
  pl.receivedCardId = null
  if (allPlayed(next)) beginReveal(next)
  return { ok: true, state: next }
}
