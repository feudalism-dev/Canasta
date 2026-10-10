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

function pickPlay(state: IchiState): IchiMove | null {
  const v = state.config.variant
  const me = state.current

  if (v === 'dos') {
    const a = legalPlays(state, me, 0)
    const b = legalPlays(state, me, 1)
    // Prefer doubles of same number
    const hand = state.players[me]!.hand
    const byKind = new Map<string, typeof hand>()
    for (const c of hand) {
      if (c.kind === 'wild' || c.kind === 'wdf') continue
      const list = byKind.get(c.kind) ?? []
      list.push(c)
      byKind.set(c.kind, list)
    }
    for (const [, list] of byKind) {
      if (list.length >= 2 && (a.some((x) => x.id === list[0]!.id) || b.some((x) => x.id === list[0]!.id))) {
        return { t: 'playTwo', cardIds: [list[0]!.id, list[1]!.id] }
      }
    }
    const pool = [...a.map((c) => ({ c, pile: 0 as const })), ...b.map((c) => ({ c, pile: 1 as const }))]
    if (!pool.length) return { t: 'draw' }
    pool.sort((x, y) => cardPoints(y.c) - cardPoints(x.c))
    return { t: 'play', cardId: pool[0]!.c.id, pile: pool[0]!.pile }
  }

  if (v === 'palace') {
    const legal = legalPlays(state, me)
    if (!legal.length) return { t: 'takePile' }
    const ranked = [...legal].sort((a, b) => cardPoints(a) - cardPoints(b))
    return { t: 'play', cardId: ranked[0]!.id }
  }

  const legal = legalPlays(state, me)
  if (legal.length) {
    const ranked = [...legal].sort((a, b) => {
      const wa = a.kind === 'wild' || a.kind === 'wdf' || a.kind === 'flip' ? 1 : 0
      const wb = b.kind === 'wild' || b.kind === 'wdf' || b.kind === 'flip' ? 1 : 0
      if (wa !== wb) return wa - wb
      return cardPoints(b) - cardPoints(a)
    })
    return { t: 'play', cardId: ranked[0]!.id }
  }

  if (state.drawnPlayableId) return { t: 'pass' }
  if (v === 'switch' && state.pendingDraw > 0) return { t: 'draw' }
  return { t: 'draw' }
}

export function pickIchiBotMove(state: IchiState): IchiMove | null {
  const me = currentPlayer(state)
  if (!me.isComputer) return null
  if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null

  if (state.phase === 'colorPick' && state.colorPicker === state.current) {
    return { t: 'chooseColor', color: mostHeldColor(state) }
  }

  if (state.phase === 'challenge' && state.challengeTarget === state.current) {
    if (me.hand.length <= 3 && Math.random() < 0.25) return { t: 'challenge' }
    return { t: 'acceptWdf' }
  }

  if (state.phase !== 'play') return null

  if (
    (state.config.variant === 'classic' || state.config.variant === 'flip') &&
    state.ichiPending === state.current &&
    me.hand.length === 1 &&
    !state.ichiCalled[state.current]
  ) {
    return { t: 'callIchi' }
  }

  return pickPlay(state)
}

export function stepIchiBot(state: IchiState): IchiState | null {
  const move = pickIchiBotMove(state)
  if (!move) return null
  const res = applyIchiMove(state, move)
  return res.ok ? res.state : null
}

/** Pause at the start of each bot turn so play reads natural and Call Ichi has a window. */
const THINK_MS_MIN = 1200
const THINK_MS_MAX = 2000

function thinkDelayMs(): number {
  return THINK_MS_MIN + Math.floor(Math.random() * (THINK_MS_MAX - THINK_MS_MIN + 1))
}

export async function pumpIchiBots(
  state: IchiState,
  opts: {
    isCancelled: () => boolean
    onThinking: (on: boolean) => void
    onStep: (next: IchiState) => void
    /** Live match state — picks up off-turn Call Ichi during the think pause. */
    getState?: () => IchiState
  },
): Promise<IchiState> {
  let cur = state
  opts.onThinking(true)
  try {
    while (!opts.isCancelled()) {
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break

      const actor =
        cur.phase === 'colorPick' && cur.colorPicker != null
          ? cur.colorPicker
          : cur.phase === 'challenge' && cur.challengeTarget != null
            ? cur.challengeTarget
            : cur.current

      const pl = cur.players[actor]
      if (!pl?.isComputer) break

      if (cur.current !== actor) {
        cur = { ...cur, current: actor }
      }

      await new Promise((r) => window.setTimeout(r, thinkDelayMs()))
      if (opts.isCancelled()) break
      // Re-sync after the pause (human may have called Ichi).
      if (opts.getState) cur = opts.getState()
      if (cur.phase === 'roundEnd' || cur.phase === 'matchEnd') break
      const actorNow =
        cur.phase === 'colorPick' && cur.colorPicker != null
          ? cur.colorPicker
          : cur.phase === 'challenge' && cur.challengeTarget != null
            ? cur.challengeTarget
            : cur.current
      if (!cur.players[actorNow]?.isComputer) break

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
