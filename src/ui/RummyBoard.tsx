import { useMemo, useState } from 'react'
import { applyRummyMove } from '../core/rummy/rules'
import { createRummyMatch, dealNextRummyRound } from '../core/rummy/state'
import type { RummyMove, RummyState, RummyVariant } from '../core/rummy/types'
import { CardView } from './CardView'

type Props = {
  yourName: string
  variant: RummyVariant
  onExit: () => void
}

export function RummyBoard({ yourName, variant, onExit }: Props) {
  const [state, setState] = useState<RummyState>(() =>
    createRummyMatch([yourName, 'Computer'], [false, true], variant),
  )
  const [selected, setSelected] = useState<string[]>([])
  const [err, setErr] = useState('')

  const you = state.players[0]!
  const topDiscard = state.discard[state.discard.length - 1]
  const yourTurn = state.current === 0 && state.phase !== 'roundEnd' && state.phase !== 'matchEnd'
  const roundOver = state.phase === 'roundEnd'
  const matchOver = state.phase === 'matchEnd'

  const status = useMemo(() => {
    if (matchOver) {
      const winner = state.players.find((p) => p.id === state.winnerId)
      return `Match over — ${winner?.name ?? 'lowest score'} wins (lowest score after someone reaches ${state.config.playTo})`
    }
    if (roundOver) {
      return 'Someone went out — opponents score the points left in their hands. Deal the next hand when ready.'
    }
    if (!yourTurn) return `${state.players[state.current]!.name}'s turn`
    if (state.phase === 'draw') return '1) Draw: tap Stock or the discard pile'
    if (you.hand.length <= 1 && state.drew) {
      return 'You can go out — meld your last set/run, or discard your last card'
    }
    return '2) Optional: select 3+ cards → Meld · 3) Select 1 card → Discard (ends your turn)'
  }, [state, yourTurn, you.hand.length, roundOver, matchOver])

  const tip = useMemo(() => {
    if (roundOver || matchOver) return null
    return 'Goal: empty your hand. Melds are 3+ of a kind, or 3+ in suit in a row (A-2-3 or Q-K-A). Going out ends the hand.'
  }, [roundOver, matchOver])

  const play = (move: RummyMove) => {
    const res = applyRummyMove(state, move)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setErr('')
    setSelected([])
    let next = res.state
    while (
      next.phase !== 'roundEnd' &&
      next.phase !== 'matchEnd' &&
      next.players[next.current]?.isComputer
    ) {
      const bot = next.players[next.current]!
      if (!next.drew) {
        const d = applyRummyMove(next, { t: 'drawStock' })
        if (!d.ok) break
        next = d.state
      } else {
        const cardId = bot.hand[0]?.id
        if (!cardId) break
        const d = applyRummyMove(next, { t: 'discard', cardId })
        if (!d.ok) break
        next = d.state
      }
    }
    setState(next)
  }

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const nextHand = () => {
    setErr('')
    setSelected([])
    setState(dealNextRummyRound(state))
  }

  const newMatch = () => {
    setErr('')
    setSelected([])
    setState(createRummyMatch([yourName, 'Computer'], [false, true], variant))
  }

  return (
    <div className="shell-game rummy-board">
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          ← Menu
        </button>
        <div>
          <h2>Standard Rummy</h2>
          <p className="muted">{status}</p>
          <p className="muted">
            Hand {state.round} · You {you.score} · Computer {state.players[1]!.score} · Stock{' '}
            {state.stock.length}
            {state.config.playTo != null ? ` · play to ${state.config.playTo}` : ''}
          </p>
          {tip ? <p className="rummy-tip">{tip}</p> : null}
        </div>
      </header>
      {err ? <p className="error">{err}</p> : null}

      {roundOver || matchOver ? (
        <div className="rummy-actions">
          {roundOver ? (
            <button type="button" className="btn primary" onClick={nextHand}>
              Deal next hand
            </button>
          ) : null}
          <button type="button" className={matchOver ? 'btn primary' : 'btn secondary'} onClick={newMatch}>
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
            <div key={m.id} className="rummy-meld">
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
