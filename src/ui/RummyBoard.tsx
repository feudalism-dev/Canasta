import { useEffect, useMemo, useState } from 'react'
import type { RummyMove, RummyState, RummyVariant } from '../core/rummy/types'
import { createRummyMatch, dealNextRummyRound } from '../core/rummy/state'
import { applyRummyMove } from '../core/rummy/rules'
import { canKnockWithDiscard } from '../core/rummy/partition'
import { layoffTargets } from '../core/rummy/melds'
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
    const seats = variant === 'gin' ? 2 : playerCount
    const names = [yourName || 'You']
    const computers = [false]
    for (let i = 1; i < seats; i++) {
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
  const isGin = (state?.config.variant ?? variant) === 'gin'
  const yourTurn = Boolean(
    state &&
      you &&
      state.current === localIndex &&
      state.phase !== 'roundEnd' &&
      state.phase !== 'matchEnd',
  )
  const roundOver = state?.phase === 'roundEnd'
  const matchOver = state?.phase === 'matchEnd'

  const knockInfo =
    state && you && isGin && yourTurn && state.drew && selected.length === 1
      ? canKnockWithDiscard(you.hand, selected[0]!, state.config)
      : null

  const selectedCards =
    state && you ? you.hand.filter((c) => selected.includes(c.id)) : []
  const layTargets =
    !isGin && state && yourTurn && state.drew && selectedCards.length > 0
      ? layoffTargets(state.players, selectedCards)
      : []

  const status = useMemo(() => {
    if (!state || !you) return 'Dealing…'
    if (matchOver) {
      const winner = state.players.find((p) => p.id === state.winnerId)
      const how = state.config.scoreAscending ? 'lowest score' : 'highest score'
      return `Match over — ${winner?.name ?? how} wins`
    }
    if (roundOver) {
      return state.lastHandNote
        ? `${state.lastHandNote} Deal next hand when ready.`
        : 'Hand over — Deal next hand when ready.'
    }
    if (thinking) return 'Computers are thinking…'
    if (!yourTurn) return `${state.players[state.current]!.name}'s turn`
    if (state.phase === 'draw') {
      if (isGin && state.stock.length <= 2) {
        return '1) Stock closed — take discard, or tap Stock to end the hand'
      }
      return '1) Draw: tap Stock or the discard pile'
    }
    if (isGin) {
      return '2) Discard one card — or Knock if deadwood ≤ 10 (Gin = 0)'
    }
    if (selected.length && layTargets.length) {
      return 'Tap a highlighted meld to lay off, or use Lay off'
    }
    if (you.hand.length <= 1 && state.drew) {
      return 'Lay off onto a meld or discard your last card to go out'
    }
    return '2) Meld (3+) or lay off onto a table meld · 3) Discard one to end turn'
  }, [state, you, yourTurn, roundOver, matchOver, thinking, isGin, selected.length, layTargets.length])

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
  const title = isGin ? 'Gin Rummy' : 'Standard Rummy'

  return (
    <div className="shell-game rummy-board">
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          ← Menu
        </button>
        <div>
          <h2>
            {title} · {state.players.length} players
          </h2>
          <p className="muted">{status}</p>
          <p className="muted">
            Hand {state.round} · {scores} · Stock {state.stock.length}
            {isGin ? ` · knock ≤ ${state.config.knockMax ?? 10}` : ''}
          </p>
          <p className="rummy-tip">
            {isGin
              ? 'Keep melds in hand. Knock with ≤10 deadwood after discard (0 = Gin). Opponent may undercut. First to 100 (highest) wins.'
              : 'Free-for-all. Meld 3+ or select cards and tap a table meld to lay off. Empty your hand (layoff or final discard) to go out.'}
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
          pl.melds.map((m) => {
            const canLay = layTargets.some((t) => t.seat === pl.seat && t.meldId === m.id)
            return (
              <button
                key={`${pl.id}-${m.id}`}
                type="button"
                className={`rummy-meld${canLay ? ' layoff-target' : ''}`}
                disabled={!canLay}
                title={canLay ? 'Lay off selected card(s) here' : undefined}
                onClick={() => {
                  if (!canLay) return
                  play({
                    t: 'layoff',
                    meldOwnerSeat: pl.seat,
                    meldId: m.id,
                    cardIds: selected,
                  })
                }}
              >
                <span className="muted tiny">
                  {pl.name}: {m.kind}
                  {canLay ? ' · tap to lay off' : ''}
                </span>
                <div className="rummy-card-row">
                  {m.cards.map((c) => (
                    <CardView key={c.id} card={c} size="sm" />
                  ))}
                </div>
              </button>
            )
          }),
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
          {!isGin ? (
            <>
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
                disabled={!yourTurn || !state.drew || layTargets.length !== 1}
                title={
                  layTargets.length > 1
                    ? 'Multiple melds fit — tap the meld you want'
                    : layTargets.length === 0
                      ? 'Select card(s) that extend a table meld'
                      : `Lay off on ${layTargets[0]!.ownerName}'s ${layTargets[0]!.kind}`
                }
                onClick={() => {
                  const t = layTargets[0]
                  if (!t) return
                  play({
                    t: 'layoff',
                    meldOwnerSeat: t.seat,
                    meldId: t.meldId,
                    cardIds: selected,
                  })
                }}
              >
                Lay off
              </button>
            </>
          ) : null}
          {isGin ? (
            <button
              type="button"
              className="btn primary"
              disabled={!yourTurn || !state.drew || selected.length !== 1 || !knockInfo?.ok}
              onClick={() => play({ t: 'knock', cardId: selected[0]! })}
              title={
                knockInfo && !knockInfo.ok
                  ? knockInfo.error
                  : knockInfo?.ok && knockInfo.gin
                    ? 'Gin!'
                    : knockInfo?.ok
                      ? `Knock with ${knockInfo.partition.points} deadwood`
                      : 'Select one card to discard when knocking'
              }
            >
              {knockInfo?.ok && knockInfo.gin
                ? 'Gin!'
                : knockInfo?.ok
                  ? `Knock (${knockInfo.partition.points})`
                  : 'Knock'}
            </button>
          ) : null}
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
