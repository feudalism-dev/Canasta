import { useMemo, useState } from 'react'
import { applyRummyMove } from '../core/rummy/rules'
import { createRummyMatch } from '../core/rummy/state'
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

  const status = useMemo(() => {
    if (state.phase === 'matchEnd') return 'Match over'
    if (state.phase === 'roundEnd') return 'Round over'
    if (!yourTurn) return `${state.players[state.current]!.name}'s turn`
    if (state.phase === 'draw') return 'Draw from stock or take discard'
    return 'Meld, lay off, or discard'
  }, [state, yourTurn])

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
            You {you.score} · Computer {state.players[1]!.score} · Stock {state.stock.length}
          </p>
        </div>
      </header>
      {err ? <p className="error">{err}</p> : null}

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
            onClick={() => toggle(c.id)}
          />
        ))}
      </div>

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
      <p className="muted tiny">{state.log.slice(-3).join(' · ')}</p>
    </div>
  )
}
