import { useEffect, useMemo, useState } from 'react'
import type { RummyMove, RummyState, RummyVariant } from '../core/rummy/types'
import { createRummyMatch, dealNextRummyRound } from '../core/rummy/state'
import { applyRummyMove } from '../core/rummy/rules'
import { pumpRummyBots } from '../ai/rummyBot'
import { CardView } from './CardView'

export type RummyBoardController = {
  state: RummyState
  localIndex: number
  aiThinking?: boolean
  submit: (move: RummyMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
}

type Props = {
  yourName: string
  variant: RummyVariant
  onExit: () => void
  /** When set, board is driven by solo/MP session. */
  controller?: RummyBoardController | null
  /** Solo fallback when no controller: total seats 2–4. */
  playerCount?: number
}

export function RummyBoard({ yourName, variant, onExit, controller, playerCount = 2 }: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<RummyState | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [aiThinking, setAiThinking] = useState(false)

  useEffect(() => {
    if (!controller?.onChange) return
    return controller.onChange(() => setTick((t) => t + 1))
  }, [controller])

  useEffect(() => {
    if (controller) {
      setFallback(null)
      return
    }
    const names = [yourName || 'You']
    const computers = [false]
    for (let i = 1; i < playerCount; i++) {
      names.push(`Computer ${i}`)
      computers.push(true)
    }
    let cancelled = false
    let cur = createRummyMatch(names, computers, variant)
    setFallback(cur)
    const pump = async () => {
      setAiThinking(true)
      cur = await pumpRummyBots(cur, {
        isCancelled: () => cancelled,
        onThinking: setAiThinking,
        onStep: (next) => {
          cur = next
          if (!cancelled) setFallback(next)
        },
      })
      if (!cancelled) {
        setFallback(cur)
        setAiThinking(false)
      }
    }
    void pump()
    return () => {
      cancelled = true
    }
  }, [controller, yourName, variant, playerCount])

  void tick
  const state = controller?.state ?? fallback
  const localIndex = controller?.localIndex ?? 0
  const thinking = controller?.aiThinking ?? aiThinking
  const you = state?.players[localIndex]
  const yourTurn = Boolean(
    state &&
      you &&
      state.current === localIndex &&
      state.phase !== 'roundEnd' &&
      state.phase !== 'matchEnd',
  )
  const roundOver = state?.phase === 'roundEnd'
  const matchOver = state?.phase === 'matchEnd'

  const status = useMemo(() => {
    if (!state || !you) return 'Dealing…'
    if (matchOver) {
      const winner = state.players.find((p) => p.id === state.winnerId)
      return `Match over — ${winner?.name ?? 'lowest score'} wins`
    }
    if (roundOver) return 'Hand over — Deal next hand when ready.'
    if (thinking) return 'Computers are thinking…'
    if (!yourTurn) return `${state.players[state.current]!.name}'s turn`
    if (state.phase === 'draw') return '1) Draw: tap Stock or the discard pile'
    if (you.hand.length <= 1 && state.drew) {
      return 'You can go out — meld or discard your last card(s)'
    }
    return '2) Optional meld (3+) · 3) Discard one card to end your turn'
  }, [state, you, yourTurn, roundOver, matchOver, thinking])

  const play = (move: RummyMove) => {
    if (controller) {
      const res = controller.submit(move)
      if (!res.ok) setErr(res.error)
      else {
        setErr('')
        setSelected([])
      }
      return
    }
    if (!state) return
    const res = applyRummyMove(state, move)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setErr('')
    setSelected([])
    let next = res.state
    setFallback(next)
    void (async () => {
      setAiThinking(true)
      next = await pumpRummyBots(next, {
        isCancelled: () => false,
        onThinking: setAiThinking,
        onStep: (s) => setFallback(s),
      })
      setFallback(next)
      setAiThinking(false)
    })()
  }

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (!state || !you) {
    return (
      <div className="shell-game rummy-board">
        <p className="muted">Dealing…</p>
      </div>
    )
  }

  const topDiscard = state.discard[state.discard.length - 1]
  const scores = state.players.map((p) => `${p.name} ${p.score}`).join(' · ')

  return (
    <div className="shell-game rummy-board">
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          ← Menu
        </button>
        <div>
          <h2>Standard Rummy · {state.players.length} players</h2>
          <p className="muted">{status}</p>
          <p className="muted">
            Hand {state.round} · {scores} · Stock {state.stock.length}
          </p>
          <p className="rummy-tip">
            Free-for-all (no teams). Empty your hand to go out. Melds: 3+ of a kind, or 3+ suited run.
          </p>
        </div>
      </header>
      {err ? <p className="error">{err}</p> : null}

      {roundOver || matchOver ? (
        <div className="rummy-actions">
          {roundOver ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (controller) controller.nextHand()
                else setFallback(dealNextRummyRound(state))
              }}
            >
              Deal next hand
            </button>
          ) : null}
          <button
            type="button"
            className={matchOver ? 'btn primary' : 'btn secondary'}
            onClick={() => {
              if (controller?.newMatch) controller.newMatch()
              else if (!controller) {
                const names = state.players.map((p) => p.name)
                const computers = state.players.map((p) => p.isComputer)
                setFallback(createRummyMatch(names, computers, variant))
              }
            }}
          >
            New match
          </button>
          <button type="button" className="btn ghost" onClick={onExit}>
            Leave table
          </button>
        </div>
      ) : null}

      <div className="rummy-piles">
        <button
          type="button"
          className="rummy-pile"
          disabled={!yourTurn || state.drew}
          onClick={() => play({ t: 'drawStock' })}
        >
          <span className="pile-label">Stock · {state.stock.length}</span>
          <CardView facedown size="lg" />
        </button>
        <button
          type="button"
          className="rummy-pile"
          disabled={!yourTurn || state.drew || !topDiscard}
          onClick={() => play({ t: 'takeDiscard' })}
        >
          <span className="pile-label">Discard</span>
          {topDiscard ? <CardView card={topDiscard} size="lg" /> : <div className="pile-empty">Empty</div>}
        </button>
      </div>

      <div className="rummy-melds">
        {state.players.flatMap((pl) =>
          pl.melds.map((m) => (
            <div key={`${pl.id}-${m.id}`} className="rummy-meld">
              <span className="muted tiny">
                {pl.name}: {m.kind}
              </span>
              <div className="rummy-card-row">
                {m.cards.map((c) => (
                  <CardView key={c.id} card={c} size="sm" />
                ))}
              </div>
            </div>
          )),
        )}
      </div>

      <div className="rummy-opponents">
        {state.players.map((pl, i) =>
          i === localIndex ? null : (
            <span key={pl.id} className="muted tiny">
              {pl.name}: {pl.hand.length} cards
              {state.current === i ? ' · turn' : ''}
            </span>
          ),
        )}
      </div>

      <div className="rummy-hand" role="list" aria-label="Your hand">
        {you.hand.map((c) => (
          <CardView
            key={c.id}
            card={c}
            size="md"
            selected={selected.includes(c.id)}
            onClick={() => (yourTurn ? toggle(c.id) : undefined)}
          />
        ))}
      </div>

      {!roundOver && !matchOver ? (
        <div className="rummy-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!yourTurn || !state.drew || selected.length < 3}
            onClick={() => play({ t: 'meld', cardIds: selected })}
          >
            Meld
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!yourTurn || !state.drew || selected.length !== 1}
            onClick={() => play({ t: 'discard', cardId: selected[0]! })}
          >
            Discard
          </button>
        </div>
      ) : null}
      <p className="muted tiny">{state.log.slice(-3).join(' · ')}</p>
    </div>
  )
}
