import { isWild, sortSkippoHand } from './deck'
import { cloneSkippo, maybeWin, refillHand, stockTop } from './state'
import type { SkippoCard, SkippoMove, SkippoState } from './types'

export type SkippoApplyResult = { ok: true; state: SkippoState } | { ok: false; error: string }

function cardFitsBuilder(card: SkippoCard, nextNeeded: number): boolean {
  if (isWild(card)) return true
  return card.rank === nextNeeded
}

/** Jump-in requires an exact natural rank — no wilds. */
function cardFitsJumpIn(card: SkippoCard, nextNeeded: number): boolean {
  if (isWild(card)) return false
  return card.rank === nextNeeded
}

export function legalBuilderIndices(
  state: SkippoState,
  card: SkippoCard,
  opts?: { jumpIn?: boolean },
): (0 | 1 | 2 | 3)[] {
  const out: (0 | 1 | 2 | 3)[] = []
  for (let i = 0; i < 4; i++) {
    const b = state.builders[i]!
    const ok = opts?.jumpIn ? cardFitsJumpIn(card, b.next) : cardFitsBuilder(card, b.next)
    if (ok) out.push(i as 0 | 1 | 2 | 3)
  }
  return out
}

export type LegalPlay = {
  source: 'hand' | 'stock' | 'discard'
  card: SkippoCard
  builder: 0 | 1 | 2 | 3
  discardIndex?: 0 | 1 | 2 | 3
}

function collectPlays(
  state: SkippoState,
  playerIndex: number,
  jumpIn: boolean,
): LegalPlay[] {
  const pl = state.players[playerIndex]!
  const out: LegalPlay[] = []
  const fit = (card: SkippoCard) => legalBuilderIndices(state, card, { jumpIn })

  for (const card of pl.hand) {
    for (const bi of fit(card)) {
      out.push({ source: 'hand', card, builder: bi })
    }
  }

  const top = stockTop(pl)
  if (top) {
    for (const bi of fit(top)) {
      out.push({ source: 'stock', card: top, builder: bi })
    }
  }

  for (let d = 0; d < 4; d++) {
    const pile = pl.discards[d]!
    if (!pile.length) continue
    const card = pile[pile.length - 1]!
    for (const bi of fit(card)) {
      out.push({ source: 'discard', card, builder: bi, discardIndex: d as 0 | 1 | 2 | 3 })
    }
  }

  return out
}

export function legalPlays(state: SkippoState, playerIndex: number): LegalPlay[] {
  if (state.phase !== 'play' || playerIndex !== state.current) return []
  return collectPlays(state, playerIndex, false)
}

/** Off-turn exact-rank plays (Jump-In variant). */
export function legalJumpIns(state: SkippoState, playerIndex: number): LegalPlay[] {
  if (!state.config.jumpIn) return []
  if (state.phase !== 'play') return []
  if (playerIndex === state.current) return []
  return collectPlays(state, playerIndex, true)
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

function takeCard(
  pl: SkippoState['players'][number],
  source: 'hand' | 'stock' | 'discard',
  cardId: string | undefined,
  discardIndex: number | undefined,
): { ok: true; card: SkippoCard } | { ok: false; error: string } {
  if (source === 'hand') {
    if (!cardId) return { ok: false, error: 'Pick a hand card' }
    const card = pl.hand.find((c) => c.id === cardId)
    if (!card) return { ok: false, error: 'Card not in hand' }
    pl.hand = sortSkippoHand(pl.hand.filter((c) => c.id !== card.id))
    return { ok: true, card }
  }
  if (source === 'stock') {
    const card = stockTop(pl)
    if (!card) return { ok: false, error: 'Stock empty' }
    pl.stock = pl.stock.slice(0, -1)
    return { ok: true, card }
  }
  const di = discardIndex
  if (di == null || di < 0 || di > 3) return { ok: false, error: 'Pick a discard pile' }
  const pile = pl.discards[di]!
  const card = pile[pile.length - 1]
  if (!card) return { ok: false, error: 'Empty discard' }
  if (cardId && card.id !== cardId) return { ok: false, error: 'Not the top discard' }
  pl.discards[di] = pile.slice(0, -1)
  return { ok: true, card }
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

  if (move.t === 'jumpIn') {
    if (!next.config.jumpIn) return { ok: false, error: 'Jump-In not in this variant' }
    // Find which player is jumping — caller passes via playing from their hand while not current.
    // We infer jumper as the owner of the card among non-current players.
    let jumper = -1
    for (let i = 0; i < next.players.length; i++) {
      if (i === next.current) continue
      const legal = legalJumpIns(next, i)
      const match = legal.some(
        (p) =>
          p.source === move.source &&
          p.builder === move.builder &&
          (move.source !== 'hand' || p.card.id === move.cardId) &&
          (move.source !== 'discard' || p.discardIndex === move.discardIndex) &&
          (move.source !== 'stock' || p.card.id === (stockTop(next.players[i]!)?.id ?? '')),
      )
      if (match) {
        jumper = i
        break
      }
    }
    if (jumper < 0) return { ok: false, error: 'Illegal jump-in' }
    const pl = next.players[jumper]!
    const taken = takeCard(pl, move.source, move.cardId, move.discardIndex)
    if (!taken.ok) return taken
    if (!cardFitsJumpIn(taken.card, next.builders[move.builder]!.next)) {
      return { ok: false, error: 'Jump-In needs exact rank' }
    }
    placeOnBuilder(next, move.builder, taken.card)
    next.log.push(
      `${pl.name} jumps in ${taken.card.rank} → builder ${move.builder + 1}.`,
    )
    next.lastMessage = next.log[next.log.length - 1]!
    if (maybeWin(next, jumper)) return { ok: true, state: next }
    return { ok: true, state: next }
  }

  if (!next.filled) refillHand(next, next.current)
  const me = next.current
  const pl = next.players[me]!

  if (move.t === 'play') {
    const bi = move.builder
    if (bi < 0 || bi > 3) return { ok: false, error: 'Bad builder' }
    const allowed = legalPlays(next, me).some(
      (p) =>
        p.source === move.source &&
        p.builder === bi &&
        (move.source !== 'hand' || p.card.id === move.cardId) &&
        (move.source !== 'discard' || p.discardIndex === move.discardIndex),
    )
    if (!allowed) return { ok: false, error: 'Illegal play' }
    const taken = takeCard(pl, move.source, move.cardId, move.discardIndex)
    if (!taken.ok) return taken
    placeOnBuilder(next, bi, taken.card)
    next.log.push(
      `${pl.name} plays ${taken.card.rank == null ? 'Skippo' : taken.card.rank} → builder ${bi + 1}.`,
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
