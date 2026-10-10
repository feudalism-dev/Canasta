import { applySkippoMove, legalPlays } from '../core/skippo/rules'
import { currentPlayer, stockTop } from '../core/skippo/state'
import type { SkippoMove, SkippoState } from '../core/skippo/types'

function pickPlay(state: SkippoState): SkippoMove | null {
  const me = state.current
  const pl = currentPlayer(state)
  const legal = legalPlays(state, me)

  // Prefer stock plays (progress toward winning).
  const stockPlays = legal.filter((p) => p.source === 'stock')
  if (stockPlays.length) {
    return { t: 'play', source: 'stock', builder: stockPlays[0]!.builder }
  }

  // Prefer completing a builder (next will wrap after 12).
  const completing = legal.filter((p) => state.builders[p.builder]!.next === 12)
  if (completing.length) {
    const p = completing[0]!
    return {
      t: 'play',
      source: p.source,
      builder: p.builder,
      cardId: p.source === 'hand' ? p.card.id : undefined,
      discardIndex: p.discardIndex,
    }
  }

  // Prefer hand over discard (keep discard tops flexible).
  const handPlays = legal.filter((p) => p.source === 'hand')
  if (handPlays.length) {
    // Spend non-wilds first when possible.
    handPlays.sort((a, b) => {
      const wa = a.card.rank == null ? 1 : 0
      const wb = b.card.rank == null ? 1 : 0
      if (wa !== wb) return wa - wb
      return (b.card.rank ?? 0) - (a.card.rank ?? 0)
    })
    const p = handPlays[0]!
    return { t: 'play', source: 'hand', cardId: p.card.id, builder: p.builder }
  }

  const discardPlays = legal.filter((p) => p.source === 'discard')
  if (discardPlays.length) {
    const p = discardPlays[0]!
    return {
      t: 'play',
      source: 'discard',
      builder: p.builder,
      discardIndex: p.discardIndex,
      cardId: p.card.id,
    }
  }

  // Discard: prefer a card that does not match stock top's near future; dump high numbers / wilds last.
  if (!pl.hand.length) return null
  const ranked = [...pl.hand].sort((a, b) => {
    const wa = a.rank == null ? 100 : a.rank
    const wb = b.rank == null ? 100 : b.rank
    return wa - wb
  })
  const card = ranked[0]!
  // Prefer empty discard pile, else shortest.
  let bestDi: 0 | 1 | 2 | 3 = 0
  let bestLen = Infinity
  for (let i = 0; i < 4; i++) {
    const len = pl.discards[i]!.length
    if (len < bestLen) {
      bestLen = len
      bestDi = i as 0 | 1 | 2 | 3
    }
  }
  void stockTop
  return { t: 'discard', cardId: card.id, discardIndex: bestDi }
}

export function pickSkippoBotMove(state: SkippoState): SkippoMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null
  if (state.phase !== 'play') return null
  return pickPlay(state)
}

export function stepSkippoBot(state: SkippoState): SkippoState | null {
  const move = pickSkippoBotMove(state)
  if (!move) return null
  const res = applySkippoMove(state, move)
  return res.ok ? res.state : null
}

const THINK_MS_MIN = 1200
const THINK_MS_MAX = 2000

function thinkDelayMs(): number {
  return THINK_MS_MIN + Math.floor(Math.random() * (THINK_MS_MAX - THINK_MS_MIN + 1))
}

export async function pumpSkippoBots(
  state: SkippoState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: SkippoState) => void
    getState?: () => SkippoState
  },
): Promise<SkippoState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      const pl = cur.players[cur.current]
      if (!pl?.isComputer) break

      await new Promise((r) => window.setTimeout(r, thinkDelayMs()))
      if (opts.isCancelled()) break
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      if (!cur.players[cur.current]?.isComputer) break

      const next = stepSkippoBot(cur)
      if (!next) break
      cur = next
      opts.onStep(cur)
    }
  } finally {
    opts.onThinking(false)
  }
  return cur
}
