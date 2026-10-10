import { isWild, sortSkippoHand } from './deck'
import { cloneSkippo, maybeWin, refillHand, stockTop } from './state'
import type { SkippoCard, SkippoMove, SkippoState } from './types'

export type SkippoApplyResult = { ok: true; state: SkippoState } | { ok: false; error: string }

function cardFitsBuilder(card: SkippoCard, nextNeeded: number): boolean {
  if (isWild(card)) return true
  return card.rank === nextNeeded
}

export function legalBuilderIndices(
  state: SkippoState,
  card: SkippoCard,
): (0 | 1 | 2 | 3)[] {
  const out: (0 | 1 | 2 | 3)[] = []
  for (let i = 0; i < 4; i++) {
    const b = state.builders[i]!
    if (cardFitsBuilder(card, b.next)) out.push(i as 0 | 1 | 2 | 3)
  }
  return out
}

export type LegalPlay = {
  source: 'hand' | 'stock' | 'discard'
  card: SkippoCard
  builder: 0 | 1 | 2 | 3
  discardIndex?: 0 | 1 | 2 | 3
}

export function legalPlays(state: SkippoState, playerIndex: number): LegalPlay[] {
  if (state.phase !== 'play' || playerIndex !== state.current) return []
  const pl = state.players[playerIndex]!
  const out: LegalPlay[] = []

  for (const card of pl.hand) {
    for (const bi of legalBuilderIndices(state, card)) {
      out.push({ source: 'hand', card, builder: bi })
    }
  }

  const top = stockTop(pl)
  if (top) {
    for (const bi of legalBuilderIndices(state, top)) {
      out.push({ source: 'stock', card: top, builder: bi })
    }
  }

  for (let d = 0; d < 4; d++) {
    const pile = pl.discards[d]!
    if (!pile.length) continue
    const card = pile[pile.length - 1]!
    for (const bi of legalBuilderIndices(state, card)) {
      out.push({ source: 'discard', card, builder: bi, discardIndex: d as 0 | 1 | 2 | 3 })
    }
  }

  return out
}

function placeOnBuilder(state: SkippoState, builder: 0 | 1 | 2 | 3, card: SkippoCard): void {
  const b = state.builders[builder]!
  const asRank = isWild(card) ? b.next : card.rank!
  b.cards.push(card)
  if (asRank >= 12) {
    state.recycle.push(...b.cards)
    b.cards = []
    b.next = 1
    state.log.push(`Builder ${builder + 1} completed.`)
  } else {
    b.next = asRank + 1
  }
}

function advanceTurn(state: SkippoState): void {
  const n = state.players.length
  state.current = (state.current + 1) % n
  state.filled = false
  refillHand(state, state.current)
  state.lastMessage = `${state.players[state.current]!.name}'s turn.`
}

export function applySkippoMove(state: SkippoState, move: SkippoMove): SkippoApplyResult {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    return { ok: false, error: 'Round is over' }
  }
  const next = cloneSkippo(state)
  if (!next.filled) refillHand(next, next.current)
  const me = next.current
  const pl = next.players[me]!

  if (move.t === 'play') {
    const bi = move.builder
    if (bi < 0 || bi > 3) return { ok: false, error: 'Bad builder' }
    let card: SkippoCard | null = null

    if (move.source === 'hand') {
      if (!move.cardId) return { ok: false, error: 'Pick a hand card' }
      card = pl.hand.find((c) => c.id === move.cardId) ?? null
      if (!card) return { ok: false, error: 'Card not in hand' }
      if (!legalBuilderIndices(next, card).includes(bi)) {
        return { ok: false, error: 'Illegal on that builder' }
      }
      pl.hand = sortSkippoHand(pl.hand.filter((c) => c.id !== card!.id))
    } else if (move.source === 'stock') {
      card = stockTop(pl)
      if (!card) return { ok: false, error: 'Stock empty' }
      if (!legalBuilderIndices(next, card).includes(bi)) {
        return { ok: false, error: 'Illegal on that builder' }
      }
      pl.stock = pl.stock.slice(0, -1)
    } else {
      const di = move.discardIndex
      if (di == null || di < 0 || di > 3) return { ok: false, error: 'Pick a discard pile' }
      const pile = pl.discards[di]!
      card = pile[pile.length - 1] ?? null
      if (!card) return { ok: false, error: 'Empty discard' }
      if (move.cardId && card.id !== move.cardId) return { ok: false, error: 'Not the top discard' }
      if (!legalBuilderIndices(next, card).includes(bi)) {
        return { ok: false, error: 'Illegal on that builder' }
      }
      pl.discards[di] = pile.slice(0, -1)
    }

    placeOnBuilder(next, bi, card)
    next.log.push(
      `${pl.name} plays ${card.rank == null ? 'Skippo' : card.rank} → builder ${bi + 1}.`,
    )
    next.lastMessage = next.log[next.log.length - 1]!
    if (maybeWin(next, me)) return { ok: true, state: next }
    return { ok: true, state: next }
  }

  if (move.t === 'discard') {
    if (!pl.hand.some((c) => c.id === move.cardId)) {
      return { ok: false, error: 'Card not in hand' }
    }
    if (move.discardIndex < 0 || move.discardIndex > 3) {
      return { ok: false, error: 'Bad discard pile' }
    }
    // Must not still have an obvious forced win path? Rules allow discard anytime after plays.
    const card = pl.hand.find((c) => c.id === move.cardId)!
    pl.hand = sortSkippoHand(pl.hand.filter((c) => c.id !== card.id))
    pl.discards[move.discardIndex] = [...pl.discards[move.discardIndex]!, card]
    next.log.push(`${pl.name} discards ${card.rank == null ? 'Skippo' : card.rank}.`)
    if (maybeWin(next, me)) return { ok: true, state: next }
    advanceTurn(next)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}
