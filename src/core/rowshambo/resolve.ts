import { compareOutcome, kindLabel } from './compare'
import { playerOrderByDirection } from './state'
import type {
  RowShamBoCard,
  RowShamBoDirection,
  RowShamBoResolveStep,
  RowShamBoVariant,
} from './types'

/**
 * Chain resolution from button, walking physical seats in `direction`.
 * Contested starts as [button]. Tie → join; lose → each contested +1; win → +|contested| and replace.
 *
 * `seats[i]` is the parlor chair for player index `i` (0 this-side … 3 left).
 * When omitted, seats default to 0..n-1 (array order = table order).
 */
export function buildResolveSteps(
  plays: (RowShamBoCard | null)[],
  button: number,
  direction: RowShamBoDirection,
  variant: RowShamBoVariant,
  seats?: number[],
): { steps: RowShamBoResolveStep[]; deltas: number[] } {
  const n = plays.length
  const deltas = Array.from({ length: n }, () => 0)
  const steps: RowShamBoResolveStep[] = []
  const players = Array.from({ length: n }, (_, i) => ({ seat: seats?.[i] ?? i }))

  const order = playerOrderByDirection(players, button, direction)
  const active = order.filter((i) => plays[i])
  if (active.length <= 1) return { steps, deltas }

  let contested = [active[0]!]
  for (let ai = 1; ai < active.length; ai++) {
    const next = active[ai]!
    const champCard = plays[contested[0]!]!
    const nextCard = plays[next]!
    const outcome = compareOutcome(champCard.kind, nextCard.kind, variant)

    if (outcome === 'tie') {
      contested = [...contested, next]
      steps.push({
        contested: [...contested],
        next,
        outcome: 'tie',
        deltas: [],
        note: `${kindLabel(champCard.kind)} ties ${kindLabel(nextCard.kind)} — group grows`,
      })
      continue
    }

    if (outcome === 'a') {
      // Contested beat next
      const stepDeltas = contested.map((seat) => ({ seat, delta: 1 }))
      for (const d of stepDeltas) deltas[d.seat]! += d.delta
      steps.push({
        contested: [...contested],
        next,
        outcome: 'contestedWin',
        deltas: stepDeltas,
        note: `${contested.map((s) => `P${s + 1}`).join('&')} beat ${kindLabel(nextCard.kind)} (+1 each)`,
      })
      continue
    }

    // Next beats contested group
    const pts = contested.length
    deltas[next]! += pts
    steps.push({
      contested: [...contested],
      next,
      outcome: 'nextWin',
      deltas: [{ seat: next, delta: pts }],
      note: `${kindLabel(nextCard.kind)} beats the group for +${pts}`,
    })
    contested = [next]
  }

  return { steps, deltas }
}
