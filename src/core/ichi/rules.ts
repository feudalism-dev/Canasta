import { cardPoints, isWild, sortIchiHand } from './deck'
import { cloneIchi, drawCards, nextIndex, topCard } from './state'
import type { IchiCard, IchiColor, IchiHandScoreLine, IchiMove, IchiState } from './types'

export type IchiApplyResult = { ok: true; state: IchiState } | { ok: false; error: string }

function hasColorMatch(hand: IchiCard[], color: IchiColor): boolean {
  return hand.some((c) => c.color === color)
}

export function legalPlays(state: IchiState, playerIndex: number): IchiCard[] {
  if (state.phase !== 'play') return []
  if (playerIndex !== state.current) return []
  const pl = state.players[playerIndex]
  if (!pl) return []

  if (state.drawnPlayableId) {
    return pl.hand.filter((c) => c.id === state.drawnPlayableId)
  }

  const hasColor = hasColorMatch(pl.hand, state.currentColor)
  const top = topCard(state)
  return pl.hand.filter((c) => {
    if (c.kind === 'wild') return true
    if (c.kind === 'wdf') return !hasColor
    if (c.color === state.currentColor) return true
    if (top && c.kind === top.kind && !isWild(c)) return true
    return false
  })
}

function catchMissedIchi(state: IchiState): void {
  if (state.ichiPending == null) return
  const idx = state.ichiPending
  if (state.ichiCalled[idx]) {
    state.ichiPending = null
    return
  }
  const pl = state.players[idx]!
  if (pl.hand.length === 1) {
    drawCards(state, idx, 2)
    state.log.push(`${pl.name} forgot Ichi — draws 2.`)
    state.lastMessage = `${pl.name} forgot Ichi — draws 2.`
  }
  state.ichiPending = null
}

function scoreHand(state: IchiState, winnerIdx: number): void {
  const winner = state.players[winnerIdx]!
  let total = 0
  const deltas = new Map<string, number>()
  for (let i = 0; i < state.players.length; i++) {
    const pl = state.players[i]!
    if (i === winnerIdx) {
      deltas.set(pl.id, 0)
      continue
    }
    total += pl.hand.reduce((s, c) => s + cardPoints(c), 0)
    deltas.set(pl.id, 0)
  }
  winner.score += total
  deltas.set(winner.id, total)
  const parts = state.players.map((p) => {
    const d = deltas.get(p.id) ?? 0
    return `${p.name} ${d > 0 ? '+' : ''}${d} (${p.score})`
  })
  state.lastHandNote = `${winner.name} goes out — scores ${total}. ${parts.join('; ')}`
  state.lastHandScores = state.players.map(
    (p): IchiHandScoreLine => ({
      playerId: p.id,
      name: p.name,
      delta: deltas.get(p.id) ?? 0,
      total: p.score,
    }),
  )
  state.log.push(state.lastHandNote)
  state.lastMessage = state.lastHandNote
  state.phase = 'roundEnd'

  const target = state.config.playTo
  if (target != null) {
    const sorted = [...state.players].sort((a, b) => b.score - a.score)
    if (sorted[0]!.score >= target) {
      if (sorted[1] && sorted[0]!.score === sorted[1]!.score) {
        state.log.push(`Tied at ${sorted[0]!.score} — play another hand.`)
      } else {
        state.phase = 'matchEnd'
        state.winnerId = sorted[0]!.id
        state.log.push(`Match over — ${sorted[0]!.name} wins with ${sorted[0]!.score}.`)
        state.lastMessage = state.log[state.log.length - 1]!
      }
    }
  }
}

function afterNumberOrColorSet(state: IchiState, from: number): void {
  state.current = nextIndex(state, from)
  state.phase = 'play'
}

function finishPlayEffects(state: IchiState, card: IchiCard, playerIndex: number): void {
  const n = state.players.length

  if (card.kind === 'wild') {
    state.phase = 'colorPick'
    state.colorPicker = playerIndex
    state.current = playerIndex
    state.lastMessage = `${state.players[playerIndex]!.name} played Wild — choose a color.`
    return
  }

  if (card.kind === 'wdf') {
    state.phase = 'colorPick'
    state.colorPicker = playerIndex
    state.current = playerIndex
    state.wdfPlayer = playerIndex
    state.challengeTarget = nextIndex(state, playerIndex)
    state.lastMessage = `${state.players[playerIndex]!.name} played Wild Draw Four — choose a color.`
    return
  }

  if (card.kind === 'reverse') {
    if (n === 2) {
      // Acts as skip — same player goes again
      state.direction = state.direction === 1 ? -1 : 1
      state.current = playerIndex
      state.log.push('Reverse (2 players) — skipped opponent.')
    } else {
      state.direction = state.direction === 1 ? -1 : 1
      state.current = nextIndex(state, playerIndex)
      state.log.push(`Reversed — ${state.direction === 1 ? 'clockwise' : 'counter-clockwise'}.`)
    }
    state.phase = 'play'
    return
  }

  if (card.kind === 'skip') {
    const skipped = nextIndex(state, playerIndex)
    state.current = nextIndex(state, playerIndex, 2)
    state.log.push(`${state.players[skipped]!.name} skipped.`)
    state.phase = 'play'
    return
  }

  if (card.kind === 'draw2') {
    const victim = nextIndex(state, playerIndex)
    drawCards(state, victim, 2)
    state.log.push(`${state.players[victim]!.name} draws 2 and is skipped.`)
    state.current = nextIndex(state, playerIndex, 2)
    state.phase = 'play'
    return
  }

  afterNumberOrColorSet(state, playerIndex)
}

function isPlayableDrawn(state: IchiState, card: IchiCard, hand: IchiCard[]): boolean {
  const others = hand.filter((c) => c.id !== card.id)
  const hasColor = hasColorMatch(others, state.currentColor)
  if (card.kind === 'wild') return true
  if (card.kind === 'wdf') return !hasColor
  if (card.color === state.currentColor) return true
  const top = topCard(state)
  if (top && card.kind === top.kind && !isWild(card)) return true
  return false
}

export function applyIchiMove(state: IchiState, move: IchiMove): IchiApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneIchi(state)

  if (move.t === 'callIchi') {
    const candidates = [next.current, next.ichiPending].filter((i): i is number => i != null)
    const idx = candidates.find((i) => next.players[i]!.hand.length === 1)
    if (idx == null) return { ok: false, error: 'You can only call Ichi with one card' }
    next.ichiCalled[idx] = true
    next.ichiPending = null
    next.log.push(`${next.players[idx]!.name} calls Ichi!`)
    next.lastMessage = `${next.players[idx]!.name} calls Ichi!`
    return { ok: true, state: next }
  }

  if (move.t === 'chooseColor') {
    if (next.phase !== 'colorPick' || next.colorPicker == null) {
      return { ok: false, error: 'Not choosing a color' }
    }
    const picker = next.colorPicker
    const colors: IchiColor[] = ['R', 'Y', 'G', 'B']
    if (!colors.includes(move.color)) return { ok: false, error: 'Pick R/Y/G/B' }

    next.log.push(`${next.players[picker]!.name} names ${move.color}.`)
    next.currentColor = move.color
    next.colorPicker = null

    if (next.wdfPlayer != null) {
      next.phase = 'challenge'
      next.current = next.challengeTarget ?? nextIndex(next, next.wdfPlayer)
      next.lastMessage = `${next.players[next.current]!.name} may challenge the +4.`
      return { ok: true, state: next }
    }

    next.phase = 'play'
    next.current = nextIndex(next, picker)
    next.lastMessage = `Color is ${move.color}.`
    return { ok: true, state: next }
  }

  if (move.t === 'challenge') {
    if (next.phase !== 'challenge' || next.challengeTarget == null || next.wdfPlayer == null) {
      return { ok: false, error: 'Nothing to challenge' }
    }
    const challenger = next.challengeTarget
    const accused = next.wdfPlayer
    const legal = next.wdfLegal !== false

    if (!legal) {
      drawCards(next, accused, 4)
      next.log.push(`Challenge succeeds — ${next.players[accused]!.name} draws 4.`)
      next.current = challenger
    } else {
      drawCards(next, challenger, 6)
      next.log.push(`Challenge fails — ${next.players[challenger]!.name} draws 6.`)
      next.current = nextIndex(next, challenger)
    }
    next.challengeTarget = null
    next.wdfPlayer = null
    next.colorBeforeWdf = null
    next.wdfLegal = null
    next.phase = 'play'
    next.lastMessage = next.log[next.log.length - 1]!
    return { ok: true, state: next }
  }

  if (move.t === 'acceptWdf') {
    if (next.phase !== 'challenge' || next.challengeTarget == null || next.wdfPlayer == null) {
      return { ok: false, error: 'No +4 to accept' }
    }
    const victim = next.challengeTarget
    drawCards(next, victim, 4)
    next.log.push(`${next.players[victim]!.name} draws 4.`)
    next.current = nextIndex(next, victim)
    next.challengeTarget = null
    next.wdfPlayer = null
    next.colorBeforeWdf = null
    next.wdfLegal = null
    next.phase = 'play'
    next.lastMessage = next.log[next.log.length - 1]!
    return { ok: true, state: next }
  }

  if (move.t === 'pass') {
    if (next.phase !== 'play' || !next.drawnPlayableId) {
      return { ok: false, error: 'Nothing to pass' }
    }
    const me = next.current
    next.drawnPlayableId = null
    next.current = nextIndex(next, me)
    next.lastMessage = `${next.players[me]!.name} passes.`
    return { ok: true, state: next }
  }

  if (move.t === 'draw') {
    if (next.phase !== 'play') return { ok: false, error: 'Not your play' }
    if (next.drawnPlayableId) return { ok: false, error: 'Play or pass the drawn card' }
    catchMissedIchi(next)
    const me = next.current
    if (legalPlays(next, me).length) return { ok: false, error: 'You can play a card' }
    const drawn = drawCards(next, me, 1)
    if (!drawn.length) return { ok: false, error: 'No cards to draw' }
    const card = drawn[0]!
    next.log.push(`${next.players[me]!.name} draws.`)
    if (isPlayableDrawn(next, card, next.players[me]!.hand)) {
      next.drawnPlayableId = card.id
      next.lastMessage = `${next.players[me]!.name} drew a playable card.`
      return { ok: true, state: next }
    }
    next.current = nextIndex(next, me)
    next.lastMessage = `${next.players[me]!.name} draws.`
    return { ok: true, state: next }
  }

  if (move.t === 'play') {
    if (next.phase !== 'play') return { ok: false, error: 'Not in play' }
    catchMissedIchi(next)
    const me = next.current
    const pl = next.players[me]!
    const card = pl.hand.find((c) => c.id === move.cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    const legal = legalPlays(next, me)
    if (!legal.some((c) => c.id === card.id)) return { ok: false, error: 'Illegal play' }

    if (card.kind === 'wdf') {
      next.colorBeforeWdf = next.currentColor
      next.wdfLegal = !hasColorMatch(pl.hand.filter((c) => c.id !== card.id), next.currentColor)
    }

    pl.hand = sortIchiHand(pl.hand.filter((c) => c.id !== card.id))
    next.discard.push(card)
    next.drawnPlayableId = null
    if (card.color) next.currentColor = card.color
    next.log.push(`${pl.name} played ${card.kind}${card.color ?? ''}.`)

    if (pl.hand.length === 1) {
      next.ichiPending = me
      if (pl.isComputer) {
        next.ichiCalled[me] = true
        next.ichiPending = null
        next.log.push(`${pl.name} calls Ichi!`)
      }
    }

    if (pl.hand.length === 0) {
      scoreHand(next, me)
      return { ok: true, state: next }
    }

    finishPlayEffects(next, card, me)
    next.lastMessage = next.log[next.log.length - 1] ?? next.lastMessage
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
