import { applyRowShamBoSeatMove } from '../core/rowshambo/rules'
import type { RowShamBoCard, RowShamBoState } from '../core/rowshambo/types'

function rankKeep(card: RowShamBoCard): number {
  if (card.kind === 'dynamite') return 3
  if (card.kind === 'water' || card.kind === 'earth' || card.kind === 'fire') return 2
  return 1
}

/** Pass the lowest-value card; play a mid/high card. */
export function pickPassCard(hand: RowShamBoCard[]): string | null {
  if (!hand.length) return null
  const ranked = [...hand].sort((a, b) => rankKeep(a) - rankKeep(b))
  return ranked[0]!.id
}

export function pickPlayCard(hand: RowShamBoCard[]): string | null {
  if (!hand.length) return null
  const ranked = [...hand].sort((a, b) => rankKeep(b) - rankKeep(a))
  // Prefer non-dynamite unless hand is tiny
  const nonDyn = ranked.find((c) => c.kind !== 'dynamite')
  return (hand.length <= 2 ? ranked[0]! : nonDyn ?? ranked[0]!).id
}

export function fillRowShamBoBots(state: RowShamBoState): RowShamBoState {
  let cur = state
  if (cur.phase === 'pass') {
    for (let i = 0; i < cur.players.length; i++) {
      const pl = cur.players[i]!
      if (!pl.isComputer || pl.passCardId || !pl.hand.length) continue
      const id = pickPassCard(pl.hand)
      if (!id) continue
      const res = applyRowShamBoSeatMove(cur, i, { t: 'pass', cardId: id })
      if (res.ok) cur = res.state
    }
  }
  if (cur.phase === 'play') {
    for (let i = 0; i < cur.players.length; i++) {
      const pl = cur.players[i]!
      if (!pl.isComputer || pl.playCardId || !pl.hand.length) continue
      const id = pickPlayCard(pl.hand)
      if (!id) continue
      const res = applyRowShamBoSeatMove(cur, i, { t: 'play', cardId: id })
      if (res.ok) cur = res.state
    }
  }
  return cur
}
