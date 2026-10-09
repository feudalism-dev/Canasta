import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { RummyMove, RummyState, RummyVariant } from '../core/rummy/types'
import { createRummyMatch, dealNextRummyRound } from '../core/rummy/state'
import { applyRummyMove } from '../core/rummy/rules'
import { canKnockWithDiscard } from '../core/rummy/partition'
import { layoffTargets } from '../core/rummy/melds'
import { isGinStyle } from '../core/rummy/variants'
import { pumpRummyBots } from '../ai/rummyBot'
import { CardView } from './CardView'

/** Keep prior display order; append newly drawn cards at the end. */
function mergeHandOrder(prev: string[], handIds: string[]): string[] {
  const live = new Set(handIds)
  const kept = prev.filter((id) => live.has(id))
  const keptSet = new Set(kept)
  const added = handIds.filter((id) => !keptSet.has(id))
  return [...kept, ...added]
}

function variantTitle(v: RummyVariant): string {
  switch (v) {
    case 'gin':
      return 'Gin Rummy'
    case 'oklahoma':
      return 'Oklahoma Gin'
    case 'rummy500':
      return 'Rummy 500'
    case 'kalooki':
      return 'Kalooki'
    default:
      return 'Standard Rummy'
  }
}

function variantTip(state: RummyState): string {
  const v = state.config.variant
  if (v === 'gin') {
    return 'Keep melds in hand. Knock with ≤10 deadwood after discard (0 = Gin). Opponent may undercut. First to 100 (highest) wins.'
  }
  if (v === 'oklahoma') {
    const km = state.config.knockMax ?? 10
    const mult =
      state.scoreMultThisHand > 1 ? ' Spade upcard doubles scores this hand.' : ''
    return `Oklahoma: knock ≤ ${km} from the upcard (Ace = gin only). Play to 150 (highest).${mult}`
  }
  if (v === 'rummy500') {
    return 'Meld scoring: +melds/−hand. Tap any discard to take it and everything above — you must meld or lay off that buried card. First to 500 (highest) wins.'
  }
  if (v === 'kalooki') {
    return 'Open Kalooki: 2 decks + jokers (wild in melds). Black aces 15, jokers 50 — cannot discard jokers. Nine hands; lowest score wins.'
  }
  return 'Free-for-all. Meld 3+ or lay off onto table melds. Go out by emptying your hand. Stock is not reshuffled — if it runs out, the hand is a draw (0 points). Lowest score to 100 wins.'
}

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
  const [handOrder, setHandOrder] = useState<string[]>([])
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragFromId = useRef<string | null>(null)
  const dragged = useRef(false)

  useEffect(() => {
    if (!controller?.onChange) return
    return controller.onChange(() => setTick((t) => t + 1))
  }, [controller])

  useEffect(() => {
    if (controller) {
      setFallback(null)
      return
    }
    const seats = isGinStyle(variant) ? 2 : playerCount
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
  const ginStyle = isGinStyle(state?.config.variant ?? variant)
  const deepDiscard = Boolean(state?.config.deepDiscard)
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
    state && you && ginStyle && yourTurn && state.drew && selected.length === 1
      ? canKnockWithDiscard(you.hand, selected[0]!, state.config)
      : null

  const selectedCards =
    state && you ? you.hand.filter((c) => selected.includes(c.id)) : []
  const layTargets =
    !ginStyle && state && yourTurn && state.drew && selectedCards.length > 0
      ? layoffTargets(state.players, selectedCards, state.config)
      : []

  const actingName = state?.players[state.current]?.name ?? 'Someone'
  const turnBanner = useMemo(() => {
    if (!state || !you || roundOver || matchOver) return null
    if (thinking) return { kind: 'wait' as const, text: 'Computers are thinking…' }
    if (yourTurn) return { kind: 'you' as const, text: 'Your turn' }
    return { kind: 'other' as const, text: `${actingName}'s turn` }
  }, [state, you, roundOver, matchOver, thinking, yourTurn, actingName])

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
    if (thinking) return 'Waiting for computers…'
    if (!yourTurn) return `Wait — ${actingName} is playing`
    if (state.phase === 'draw') {
      if (ginStyle && state.stock.length <= 2) {
        return 'Stock closed — take discard, or tap Stock to end the hand (draw)'
      }
      if (state.stock.length === 0) {
        return 'Stock empty — take discard, or tap Stock to call the hand a draw'
      }
      if (deepDiscard) {
        return 'Draw: tap Stock, or tap any discard card (take it + all above)'
      }
      return 'Draw: tap Stock or the discard pile'
    }
    if (state.mustUseCardId) {
      return 'Meld or lay off the card you took from the discard pile'
    }
    if (ginStyle) {
      const km = state.config.knockMax ?? 10
      return `Discard one card — or Knock if deadwood ≤ ${km} (Gin = 0)`
    }
    if (selected.length && layTargets.length) {
      return 'Tap a highlighted meld to lay off, or use Lay off'
    }
    if (you.hand.length <= 1 && state.drew) {
      return 'Lay off onto a meld or discard your last card to go out'
    }
    return 'Meld (3+) or lay off · then discard one to end your turn'
  }, [
    state,
    you,
    yourTurn,
    roundOver,
    matchOver,
    thinking,
    ginStyle,
    deepDiscard,
    selected.length,
    layTargets.length,
    actingName,
  ])

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
    if (dragged.current) {
      dragged.current = false
      return
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const moveCardInHand = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setHandOrder((prev) => {
      const from = prev.indexOf(fromId)
      const to = prev.indexOf(toId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [card] = next.splice(from, 1)
      next.splice(to, 0, card!)
      return next
    })
  }

  if (!state || !you) {
    return (
      <div className="shell-game rummy-board">
        <p className="muted">Dealing…</p>
      </div>
    )
  }

  const topDiscard = state.discard[state.discard.length - 1]
  const title = variantTitle(state.config.variant)
  const playTo = state.config.playTo
  const handsCap = state.config.handsPerMatch
  const scoreGoal =
    handsCap != null
      ? `${handsCap} hands (${state.config.scoreAscending ? 'lowest' : 'highest'} wins)`
      : playTo != null
        ? `First to ${playTo} (${state.config.scoreAscending ? 'lowest' : 'highest'} wins)`
        : null
  const ranked = [...state.players].sort((a, b) =>
    state.config.scoreAscending ? a.score - b.score : b.score - a.score,
  )
  const leaderId = ranked[0]?.id
  const handScoreById = new Map((state.lastHandScores ?? []).map((l) => [l.playerId, l]))

  const currentId = state.players[state.current]?.id
  const handIdsKey = you.hand.map((c) => c.id).join('|')
  useEffect(() => {
    setHandOrder((prev) => mergeHandOrder(prev, handIdsKey ? handIdsKey.split('|') : []))
  }, [handIdsKey])

  const handById = useMemo(() => new Map(you.hand.map((c) => [c.id, c])), [handIdsKey, you.hand])
  const orderedHand = useMemo(
    () => handOrder.map((id) => handById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [handOrder, handById],
  )

  const formatDelta = (delta: number) => {
    if (delta > 0) return `+${delta} this hand`
    if (delta < 0) return `${delta} this hand`
    return '0 this hand'
  }

  return (
    <div className={`shell-game rummy-board${yourTurn ? ' is-your-turn' : ''}`}>
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
        <div>
          <h2>
            {title} · {state.players.length} players
          </h2>
          <p className="muted">
            Hand {state.round}
            {handsCap != null ? ` / ${handsCap}` : ''} · Stock {state.stock.length}
            {ginStyle ? ` · knock ≤ ${state.config.knockMax ?? 10}` : ''}
            {state.scoreMultThisHand > 1 ? ' · ×2 spades' : ''}
            {scoreGoal ? ` · ${scoreGoal}` : ''}
          </p>
          <p className="rummy-tip">{variantTip(state)}</p>
        </div>
      </header>

      {turnBanner ? (
        <div
          className={`rummy-turn-banner is-${turnBanner.kind}`}
          role="status"
          aria-live="polite"
        >
          <strong>{turnBanner.text}</strong>
          <span>{status}</span>
        </div>
      ) : (
        <p className="muted">{status}</p>
      )}

      {err ? <p className="error">{err}</p> : null}

      <div className="rummy-scoreboard" aria-label="Match scores">
        {state.players.map((p, pi) => {
          const line = handScoreById.get(p.id)
          const isLeader = p.id === leaderId
          const isWinner = matchOver && p.id === state.winnerId
          const isTheirTurn = !roundOver && !matchOver && p.id === currentId
          return (
            <div
              key={p.id}
              className={`rummy-score-card${isLeader ? ' is-leader' : ''}${isWinner ? ' is-winner' : ''}${isTheirTurn ? ' is-turn' : ''}`}
            >
              <span className="rummy-score-name">
                {p.name}
                {pi === localIndex ? ' (you)' : ''}
                {isWinner ? ' — wins' : isLeader && !matchOver ? ' · lead' : ''}
              </span>
              <span className="rummy-score-total">{p.score}</span>
              {roundOver || matchOver ? (
                <span className="rummy-score-delta">
                  {line ? formatDelta(line.delta) : '—'}
                </span>
              ) : (
                <span className={`rummy-score-delta${isTheirTurn ? ' is-turn-label' : ' muted'}`}>
                  {isTheirTurn
                    ? pi === localIndex
                      ? 'YOUR TURN'
                      : 'THEIR TURN'
                    : `${p.hand.length} cards`}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {roundOver || matchOver ? (
        <div className="rummy-hand-end">
          <p className="rummy-hand-end-note">
            {matchOver
              ? `Match over — ${state.players.find((p) => p.id === state.winnerId)?.name ?? 'winner'} wins.`
              : state.lastHandNote ?? 'Hand over.'}
          </p>
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
        {deepDiscard ? (
          <div className="rummy-discard-fan">
            <span className="pile-label">
              Discard · tap a card to take it + all above
            </span>
            {state.discard.length === 0 ? (
              <div className="pile-empty">Empty</div>
            ) : (
              <div className="rummy-discard-row">
                {state.discard.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rummy-discard-card"
                    disabled={!yourTurn || state.drew}
                    title="Take this card and every card above it"
                    onClick={() => play({ t: 'takeDiscardDeep', fromIndex: i })}
                  >
                    <CardView card={c} size={i === state.discard.length - 1 ? 'lg' : 'sm'} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="rummy-pile"
            disabled={!yourTurn || state.drew || !topDiscard}
            onClick={() => play({ t: 'takeDiscard' })}
          >
            <span className="pile-label">Discard</span>
            {topDiscard ? <CardView card={topDiscard} size="lg" /> : <div className="pile-empty">Empty</div>}
          </button>
        )}
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

      <div
        className={`rummy-hand${yourTurn ? ' is-active' : ''}`}
        role="list"
        aria-label={yourTurn ? 'Your hand — your turn' : 'Your hand'}
      >
        {orderedHand.map((c) => (
          <div
            key={c.id}
            className={`rummy-hand-slot${dragOverId === c.id ? ' is-drop-target' : ''}${
              state.mustUseCardId === c.id ? ' is-must-use' : ''
            }`}
            draggable
            onDragStart={(e: DragEvent) => {
              dragFromId.current = c.id
              dragged.current = false
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', c.id)
            }}
            onDrag={() => {
              dragged.current = true
            }}
            onDragOver={(e: DragEvent) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (dragOverId !== c.id) setDragOverId(c.id)
            }}
            onDragLeave={() => {
              if (dragOverId === c.id) setDragOverId(null)
            }}
            onDrop={(e: DragEvent) => {
              e.preventDefault()
              const from = dragFromId.current || e.dataTransfer.getData('text/plain')
              if (from) moveCardInHand(from, c.id)
              dragFromId.current = null
              setDragOverId(null)
            }}
            onDragEnd={() => {
              dragFromId.current = null
              setDragOverId(null)
            }}
          >
            <CardView
              card={c}
              size="md"
              selected={selected.includes(c.id)}
              onClick={yourTurn ? () => toggle(c.id) : undefined}
            />
          </div>
        ))}
      </div>
      <p className="muted tiny rummy-hand-hint">Drag cards to rearrange · tap to select</p>

      {!roundOver && !matchOver ? (
        <div className="rummy-actions">
          {!ginStyle ? (
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
          {ginStyle ? (
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
            disabled={!yourTurn || !state.drew || selected.length !== 1 || Boolean(state.mustUseCardId)}
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
