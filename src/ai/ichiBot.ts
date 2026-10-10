import { ICHI_COLORS, cardPoints } from '../core/ichi/deck'
import { applyIchiMove, legalPlays } from '../core/ichi/rules'
import { currentPlayer } from '../core/ichi/state'
import type { IchiColor, IchiMove, IchiState } from '../core/ichi/types'

function mostHeldColor(state: IchiState): IchiColor {
  const me = currentPlayer(state)
  let best: IchiColor = 'R'
  let bestN = -1
  for (const c of ICHI_COLORS) {
    const n = me.hand.filter((x) => x.color === c).length
    if (n > bestN) {
      bestN = n
      best = c
    }
  }
  return best
}

export function pickIchiBotMove(state: IchiState): IchiMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null

  if (state.phase === 'colorPick' && state.colorPicker === state.current) {
    return { t: 'chooseColor', color: mostHeldColor(state) }
  }

  if (state.phase === 'challenge' && state.challengeTarget === state.current) {
    // Rarely challenge — only if hand is small (less painful to risk)
    if (me.hand.length <= 3 && Math.random() < 0.25) return { t: 'challenge' }
    return { t: 'acceptWdf' }
  }

  if (state.phase !== 'play') return null

  if (state.ichiPending === state.current && me.hand.length === 1 && !state.ichiCalled[state.current]) {
    return { t: 'callIchi' }
  }

  const legal = legalPlays(state, state.current)
  if (legal.length) {
    const ranked = [...legal].sort((a, b) => {
      // Prefer non-wilds, then highest points (dump)
      const wa = a.kind === 'wild' || a.kind === 'wdf' ? 1 : 0
      const wb = b.kind === 'wild' || b.kind === 'wdf' ? 1 : 0
      if (wa !== wb) return wa - wb
      return cardPoints(b) - cardPoints(a)
    })
    return { t: 'play', cardId: ranked[0]!.id }
  }

  if (state.drawnPlayableId) return { t: 'pass' }
  return { t: 'draw' }
}

export function stepIchiBot(state: IchiState): IchiState | null {
  const move = pickIchiBotMove(state)
  if (!move) return null
  const res = applyIchiMove(state, move)
  return res.ok ? res.state : null
}

const THINK_MS = 380

export async function pumpIchiBots(
  state: IchiState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: IchiState) => void
  },
): Promise<IchiState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break

      // Color picker / challenger may not equal "current" naming — we set current to actor
      const actor =
        cur.phase === 'colorPick' && cur.colorPicker != null
          ? cur.colorPicker
          : cur.phase === 'challenge' && cur.challengeTarget != null
            ? cur.challengeTarget
            : cur.current

      const pl = cur.players[actor]
      if (!pl?.isComputer) break

      // Ensure current matches actor for pickIchiBotMove
      if (cur.current !== actor) {
        cur = { ...cur, current: actor }
      }

      await new Promise((r) => window.setTimeout(r, THINK_MS))
      if (opts.isCancelled()) break
      const next = stepIchiBot(cur)
      if (!next) break
      cur = next
      opts.onStep(cur)
    }
  } finally {
    opts.onThinking(false)
  }
  return cur
}
