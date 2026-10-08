import { useMemo, useState } from 'react'
import { suitGlyph, isRedSuit } from '../core/cards'
import { applyRummyMove } from '../core/rummy/rules'
import { createRummyMatch } from '../core/rummy/state'
import type { RummyMove, RummyState, RummyVariant } from '../core/rummy/types'
import { CardFace } from './CardFace'

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
    // Naive computer: draw stock, discard a random card.
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
    <div className="game-board rummy-board">
      <header className="board-head">
        <button type="button" className="linkish" onClick={onExit}>
          ← Menu
        </button>
        <h2>Standard Rummy</h2>
        <p className="muted">{status}</p>
        <p className="muted">
          You {you.score} · Computer {state.players[1]!.score} · Stock {state.stock.length}
        </p>
      </header>
      {err ? <p className="scoreboard-err">{err}</p> : null}
      <div className="piles-row">
        <button type="button" disabled={!yourTurn || state.drew} onClick={() => play({ t: 'drawStock' })}>
          Stock ({state.stock.length})
        </button>
        <button
          type="button"
          disabled={!yourTurn || state.drew || !topDiscard}
          onClick={() => play({ t: 'takeDiscard' })}
        >
          {topDiscard ? (
            <CardFace card={topDiscard} />
          ) : (
            'Discard'
          )}
        </button>
      </div>
      <div className="meld-tray">
        {state.players.flatMap((pl) =>
          pl.melds.map((m) => (
            <div key={m.id} className="meld-chip">
              <span>
                {pl.name}: {m.kind}
              </span>
              <div className="card-row">
                {m.cards.map((c) => (
                  <CardFace key={c.id} card={c} />
                ))}
              </div>
            </div>
          )),
        )}
      </div>
      <div className="hand-row">
        {you.hand.map((c) => (
          <button
            key={c.id}
            type="button"
            className={selected.includes(c.id) ? 'is-on' : ''}
            onClick={() => toggle(c.id)}
            style={{ color: isRedSuit(c.suit) ? '#b33' : undefined }}
          >
            <CardFace card={c} />
            <span className="sr-only">
              {c.rank}
              {suitGlyph(c.suit)}
            </span>
          </button>
        ))}
      </div>
      <div className="actions-row">
        <button
          type="button"
          disabled={!yourTurn || !state.drew || selected.length < 3}
          onClick={() => play({ t: 'meld', cardIds: selected })}
        >
          Meld
        </button>
        <button
          type="button"
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
