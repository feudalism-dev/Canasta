import { applySkippoMove, legalJumpIns, legalPlays } from '../core/skippo/rules'
import { currentPlayer, stockTop } from '../core/skippo/state'
import type { SkippoMove, SkippoState } from '../core/skippo/types'

function toMove(
  p: { source: 'hand' | 'stock' | 'discard'; card: { id: string }; builder: 0 | 1 | 2 | 3; discardIndex?: 0 | 1 | 2 | 3 },
  t: 'play' | 'jumpIn',
): SkippoMove {
  return {
    t,
    source: p.source,
    builder: p.builder,
    cardId: p.source === 'hand' || p.source === 'discard' ? p.card.id : undefined,
    discardIndex: p.discardIndex,
  }
}

function pickPlay(state: SkippoState): SkippoMove | null {
  const me = state.current
  const pl = currentPlayer(state)
  const legal = legalPlays(state, me)

  const stockPlays = legal.filter((p) => p.source === 'stock')
  if (stockPlays.length) {
    return { t: 'play', source: 'stock', builder: stockPlays[0]!.builder }
  }

  const completing = legal.filter((p) => state.builders[p.builder]!.next === 12)
  if (completing.length) return toMove(completing[0]!, 'play')

  const handPlays = legal.filter((p) => p.source === 'hand')
  if (handPlays.length) {
    handPlays.sort((a, b) => {
      const wa = a.card.rank == null ? 1 : 0
      const wb = b.card.rank == null ? 1 : 0
      if (wa !== wb) return wa - wb
      return (b.card.rank ?? 0) - (a.card.rank ?? 0)
    })
    return toMove(handPlays[0]!, 'play')
  }

  const discardPlays = legal.filter((p) => p.source === 'discard')
  if (discardPlays.length) return toMove(discardPlays[0]!, 'play')

  // Hand empty with no stock/discard plays: rules should have mid-turn refilled;
  // if still empty, discard is impossible — return null so pump stops cleanly
  // (applySkippoMove also auto-passes when draw is exhausted).
  if (!pl.hand.length) return null

  const ranked = [...pl.hand].sort((a, b) => {
    const wa = a.rank == null ? 100 : a.rank
    const wb = b.rank == null ? 100 : b.rank
    return wa - wb
  })
  const card = ranked[0]!
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

function pickJumpIn(state: SkippoState, playerIndex: number): SkippoMove | null {
  const legal = legalJumpIns(state, playerIndex)
  if (!legal.length) return null
  // Prefer stock jump-ins
  const stock = legal.find((p) => p.source === 'stock')
  if (stock) return toMove(stock, 'jumpIn')
  return toMove(legal[0]!, 'jumpIn')
}

export function pickSkippoBotMove(state: SkippoState): SkippoMove | null {
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null
  if (state.phase !== 'play') return null

  // Off-turn jump-ins for any computer
  if (state.config.jumpIn) {
    for (let i = 0; i < state.players.length; i++) {
      if (!state.players[i]!.isComputer) continue
      if (i === state.current) continue
      const jump = pickJumpIn(state, i)
      if (jump) return jump
    }
  }

  const me = currentPlayer(state)
  if (!me.isComputer) return null
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

function anyComputerCanAct(state: SkippoState): boolean {
  if (state.phase !== 'play') return false
  if (state.players[state.current]?.isComputer) return true
  if (!state.config.jumpIn) return false
  return state.players.some(
    (p, i) => p.isComputer && i !== state.current && legalJumpIns(state, i).length > 0,
  )
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
      if (!anyComputerCanAct(cur)) break

      await new Promise((r) => window.setTimeout(r, thinkDelayMs()))
      if (opts.isCancelled()) break
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      if (!anyComputerCanAct(cur)) break

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
