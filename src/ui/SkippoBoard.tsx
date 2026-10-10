import { useEffect, useMemo, useRef, useState } from 'react'
import { pumpSkippoBots } from '../ai/skippoBot'
import { cardLabel, sortSkippoHand } from '../core/skippo/deck'
import { applySkippoMove, legalJumpIns, legalPlays, type LegalPlay } from '../core/skippo/rules'
import { createSkippoMatch, dealNextSkippoRound, stockTop } from '../core/skippo/state'
import type { SkippoCard, SkippoMove, SkippoState, SkippoVariant } from '../core/skippo/types'
import { partnerIndex, skippoTip, skippoVariantLabel } from '../core/skippo/variants'

export type SkippoBoardController = {
  state: SkippoState
  localIndex: number
  aiThinking?: boolean
  submit: (move: SkippoMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
}

type Props = {
  yourName: string
  variant: SkippoVariant
  playerCount?: number
  onExit: () => void
  controller?: SkippoBoardController | null
}

function SkippoCardFace({
  card,
  size = 'md',
  dimmed,
  legal,
  onClick,
  title,
}: {
  card: SkippoCard
  size?: 'md' | 'lg'
  dimmed?: boolean
  legal?: boolean
  onClick?: () => void
  title?: string
}) {
  const label = cardLabel(card)
  const wild = card.rank == null
  const bg = wild ? '#3d2a4a' : '#2a5f6f'
  const cls = `ichi-face skippo-face is-${size}${dimmed ? ' is-dim' : ''}${legal ? ' is-legal' : ''}${onClick ? ' is-clickable' : ''}${wild ? ' is-wild' : ''}`
  const aria = title || (wild ? 'Skippo wild' : String(card.rank))
  const body = (
    <>
      <span className="ichi-face-corner">{label}</span>
      <span className="ichi-face-center">{label}</span>
      <span className="ichi-face-corner is-br">{label}</span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} style={{ background: bg }} onClick={onClick} aria-label={aria}>
        {body}
      </button>
    )
  }
  return (
    <div className={cls} style={{ background: bg }} aria-label={aria}>
      {body}
    </div>
  )
}

export function SkippoBoard({ yourName, variant, playerCount = 4, onExit, controller }: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<SkippoState | null>(null)
  const [err, setErr] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [selected, setSelected] = useState<{
    source: 'hand' | 'stock' | 'discard'
    cardId: string
    discardIndex?: 0 | 1 | 2 | 3
  } | null>(null)
  const [discardMode, setDiscardMode] = useState(false)
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback
  const pumpGen = useRef(0)

  useEffect(() => {
    if (!controller?.onChange) return
    return controller.onChange(() => setTick((t) => t + 1))
  }, [controller])

  useEffect(() => {
    if (controller) {
      setFallback(null)
      return
    }
    const names = [yourName || 'You', 'Computer 1', 'Computer 2', 'Computer 3'].slice(0, playerCount)
    const computers = names.map((_, i) => i > 0)
    let cancelled = false
    const gen = ++pumpGen.current
    let cur = createSkippoMatch(names, computers, variant)
    setFallback(cur)
    fallbackRef.current = cur
    void (async () => {
      setAiThinking(true)
      cur = await pumpSkippoBots(cur, {
        isCancelled: () => cancelled || gen !== pumpGen.current,
        onThinking: setAiThinking,
        onStep: (next) => {
          cur = next
          fallbackRef.current = next
          if (!cancelled && gen === pumpGen.current) setFallback(next)
        },
        getState: () => fallbackRef.current ?? cur,
      })
      if (!cancelled && gen === pumpGen.current) {
        setFallback(cur)
        setAiThinking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [controller, yourName, variant, playerCount])

  void tick
  const state = controller?.state ?? fallback
  const localIndex = controller?.localIndex ?? 0
  const thinking = controller?.aiThinking ?? aiThinking
  const you = state?.players[localIndex]
  const roundOver = state?.phase === 'roundEnd'
  const matchOver = state?.phase === 'matchEnd'
  const yourTurn = state != null && state.current === localIndex && state.phase === 'play'
  const actingName = state?.players[state.current]?.name ?? 'Someone'
  const jumpMode =
    state != null &&
    state.config.jumpIn &&
    state.phase === 'play' &&
    !yourTurn &&
    !roundOver &&
    !matchOver

  const legal = useMemo(
    () =>
      state && yourTurn
        ? legalPlays(state, localIndex)
        : state && jumpMode
          ? legalJumpIns(state, localIndex)
          : [],
    [state, yourTurn, jumpMode, localIndex, tick],
  )

  const play = (move: SkippoMove) => {
    setErr('')
    setSelected(null)
    setDiscardMode(false)
    if (controller) {
      const res = controller.submit(move)
      if (!res.ok) setErr(res.error)
      return
    }
    const cur = fallbackRef.current
    if (!cur) return
    const res = applySkippoMove(cur, move)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setFallback(res.state)
    fallbackRef.current = res.state
    const gen = ++pumpGen.current
    void pumpSkippoBots(res.state, {
      isCancelled: () => gen !== pumpGen.current,
      onThinking: setAiThinking,
      onStep: (next) => {
        fallbackRef.current = next
        if (gen === pumpGen.current) setFallback(next)
      },
      getState: () => fallbackRef.current ?? res.state,
    }).then((next) => {
      if (gen === pumpGen.current) setFallback(next)
    })
  }

  if (!state || !you) {
    return (
      <div className="shell-game skippo-board">
        <p className="muted">Dealing…</p>
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
      </div>
    )
  }

  const status =
    thinking && !yourTurn
      ? `${actingName} is thinking…`
      : state.lastMessage || skippoTip(state.config.variant)
  const ranked = [...state.players].sort((a, b) => b.score - a.score)
  const leaderId = ranked[0]?.id
  const handScoreById = new Map((state.lastHandScores ?? []).map((l) => [l.playerId, l]))
  const playTo = state.config.playTo
  const orderedHand = sortSkippoHand(you.hand)
  const myStockTop = stockTop(you)

  const playsFor = (source: LegalPlay['source'], cardId: string, discardIndex?: number) =>
    legal.filter(
      (p) =>
        p.source === source &&
        p.card.id === cardId &&
        (discardIndex == null || p.discardIndex === discardIndex),
    )

  const moveKind = jumpMode ? ('jumpIn' as const) : ('play' as const)
  const canInteract = yourTurn || jumpMode

  const onSelectCard = (
    source: 'hand' | 'stock' | 'discard',
    cardId: string,
    discardIndex?: 0 | 1 | 2 | 3,
  ) => {
    if (!canInteract) return
    if (yourTurn && discardMode && source === 'hand') {
      setSelected({ source, cardId })
      return
    }
    const opts = playsFor(source, cardId, discardIndex)
    if (!opts.length) {
      if (source === 'hand' && yourTurn) setSelected({ source, cardId })
      return
    }
    if (opts.length === 1) {
      const p = opts[0]!
      play({
        t: moveKind,
        source: p.source,
        builder: p.builder,
        cardId: p.source === 'hand' ? p.card.id : undefined,
        discardIndex: p.discardIndex,
      })
      return
    }
    setSelected({ source, cardId, discardIndex })
  }

  const builderTargets =
    selected && !discardMode
      ? playsFor(selected.source, selected.cardId, selected.discardIndex).map((p) => p.builder)
      : []

  return (
    <div
      className={`shell-game skippo-board rummy-board${yourTurn || jumpMode ? ' is-your-turn' : ''}`}
    >
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
        <div>
          <h2>
            {skippoVariantLabel(state.config.variant)} · {state.players.length} players
            {state.config.partners ? ' · partners' : ''}
          </h2>
          <p className="muted">
            Hand {state.round}
            {playTo != null ? ` · first to ${playTo}` : ''}
            {` · stock ${state.config.stockSize}`}
            {` · draw ${state.draw.length}`}
          </p>
          <p className="rummy-tip">{skippoTip(state.config.variant)}</p>
        </div>
      </header>

      <div
        className={`rummy-turn-banner is-${yourTurn || jumpMode ? 'you' : thinking ? 'wait' : 'other'}`}
        role="status"
      >
        <strong>
          {thinking && !yourTurn && !jumpMode
            ? 'Computers are thinking…'
            : yourTurn
              ? discardMode
                ? 'Discard one card to end your turn'
                : 'Your turn — play, then discard'
              : jumpMode && legal.length
                ? 'Jump in! Exact rank on a builder'
                : `${actingName}'s turn`}
        </strong>
        <span>{status}</span>
      </div>

      {err ? <p className="error">{err}</p> : null}

      <div className="rummy-scoreboard" aria-label="Match scores">
        {state.players.map((p, pi) => {
          const line = handScoreById.get(p.id)
          const isLeader = p.id === leaderId
          const isWinner = matchOver && p.id === state.winnerId
          const isTheirTurn = !roundOver && !matchOver && state.current === pi
          const top = stockTop(p)
          return (
            <div
              key={p.id}
              className={`rummy-score-card${isLeader ? ' is-leader' : ''}${isWinner ? ' is-winner' : ''}${isTheirTurn ? ' is-turn' : ''}`}
            >
              <span className="rummy-score-name">
                {p.name}
                {pi === localIndex ? ' (you)' : ''}
                {state.config.partners && partnerIndex(state, localIndex) === pi ? ' · partner' : ''}
                {isWinner ? ' — wins' : isLeader && !matchOver ? ' · lead' : ''}
              </span>
              <span className="rummy-score-total">{p.score}</span>
              {roundOver || matchOver ? (
                <span className="rummy-score-delta">
                  {line ? `${line.delta > 0 ? '+' : ''}${line.delta} this hand` : '—'}
                </span>
              ) : (
                <span className="rummy-score-delta">
                  stock {p.stock.length}
                  {top ? ` · top ${cardLabel(top)}` : ''}
                  {isTheirTurn ? (pi === localIndex ? ' · YOUR TURN' : ' · THEIR TURN') : ''}
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
              ? `${state.players.find((p) => p.id === state.winnerId)?.name ?? 'Someone'} wins the match.`
              : state.lastHandNote || 'Hand over.'}
          </p>
          {!matchOver ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (controller) controller.nextHand()
                else setFallback(dealNextSkippoRound(state))
              }}
            >
              Next hand
            </button>
          ) : controller?.newMatch ? (
            <button type="button" className="btn primary" onClick={() => controller.newMatch?.()}>
              New match
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="trick-current skippo-table" aria-label="Skippo builders">
        <span className="pile-label">Building piles (need next number)</span>
        <div className="rummy-piles skippo-builders">
          {state.builders.map((b, bi) => {
            const top = b.cards[b.cards.length - 1] ?? null
            const canDrop = canInteract && builderTargets.includes(bi as 0 | 1 | 2 | 3)
            return (
              <div key={bi} className="rummy-pile">
                <span className="pile-label">
                  B{bi + 1} · need {b.next > 12 ? '—' : b.next}
                </span>
                {top ? (
                  <SkippoCardFace
                    card={top}
                    size="lg"
                    legal={canDrop}
                    onClick={
                      canDrop && selected
                        ? () =>
                            play({
                              t: moveKind,
                              source: selected.source,
                              builder: bi as 0 | 1 | 2 | 3,
                              cardId: selected.source === 'hand' ? selected.cardId : undefined,
                              discardIndex: selected.discardIndex,
                            })
                        : undefined
                    }
                  />
                ) : (
                  <button
                    type="button"
                    className={`ichi-face is-lg is-empty${canDrop ? ' is-legal' : ''}`}
                    disabled={!canDrop}
                    onClick={() => {
                      if (!canDrop || !selected) return
                      play({
                        t: moveKind,
                        source: selected.source,
                        builder: bi as 0 | 1 | 2 | 3,
                        cardId: selected.source === 'hand' ? selected.cardId : undefined,
                        discardIndex: selected.discardIndex,
                      })
                    }}
                  >
                    {b.next}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="skippo-you-row">
        <div className="rummy-pile" aria-label="Your stock">
          <span className="pile-label">Your stock ({you.stock.length})</span>
          {myStockTop ? (
            <SkippoCardFace
              card={myStockTop}
              size="lg"
              legal={canInteract && !discardMode && playsFor('stock', myStockTop.id).length > 0}
              onClick={
                canInteract && !discardMode
                  ? () => onSelectCard('stock', myStockTop.id)
                  : undefined
              }
            />
          ) : (
            <div className="ichi-face is-lg is-empty">—</div>
          )}
        </div>
        <div className="skippo-discards" aria-label="Your discard piles">
          <span className="pile-label">Your discards</span>
          <div className="rummy-card-row">
            {you.discards.map((pile, di) => {
              const top = pile[pile.length - 1]
              const canPlay =
                canInteract &&
                !discardMode &&
                top &&
                playsFor('discard', top.id, di as 0 | 1 | 2 | 3).length > 0
              const canReceive =
                yourTurn && discardMode && selected?.source === 'hand'
              return (
                <div key={di} className="rummy-pile">
                  <span className="pile-label">D{di + 1}</span>
                  {top ? (
                    <SkippoCardFace
                      card={top}
                      size="md"
                      legal={Boolean(canPlay || canReceive)}
                      onClick={
                        canReceive
                          ? () =>
                              play({
                                t: 'discard',
                                cardId: selected!.cardId,
                                discardIndex: di as 0 | 1 | 2 | 3,
                              })
                          : canPlay
                            ? () => onSelectCard('discard', top.id, di as 0 | 1 | 2 | 3)
                            : undefined
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      className={`ichi-face is-md is-empty${canReceive ? ' is-legal' : ''}`}
                      disabled={!canReceive}
                      onClick={() => {
                        if (!canReceive || !selected) return
                        play({
                          t: 'discard',
                          cardId: selected.cardId,
                          discardIndex: di as 0 | 1 | 2 | 3,
                        })
                      }}
                    >
                      —
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className={`rummy-hand${canInteract ? ' is-active' : ''}`} aria-label="Your hand">
        {orderedHand.map((c) => {
          const can = canInteract && !discardMode && playsFor('hand', c.id).length > 0
          const sel = selected?.source === 'hand' && selected.cardId === c.id
          return (
            <button
              key={c.id}
              type="button"
              className={`rummy-hand-slot ichi-hand-slot${can || (discardMode && yourTurn) ? ' is-legal-slot' : ''}${sel ? ' is-selected' : ''}`}
              disabled={!canInteract}
              onClick={() => onSelectCard('hand', c.id)}
            >
              <SkippoCardFace card={c} size="md" legal={can || sel} />
            </button>
          )
        })}
      </div>
      <p className="muted tiny rummy-hand-hint">
        {jumpMode
          ? 'Jump-In: tap an exact-rank card (no wilds), then the matching builder.'
          : 'Tap a legal card (hand, stock top, or discard top), then a builder if needed. End with Discard.'}
      </p>

      <div className="rummy-actions">
        {!roundOver && !matchOver && yourTurn ? (
          <>
            <button
              type="button"
              className={`btn ${discardMode ? 'primary' : 'secondary'}`}
              disabled={!you.hand.length}
              onClick={() => {
                setDiscardMode((v) => !v)
                setSelected(null)
              }}
            >
              {discardMode ? 'Cancel discard' : 'Discard to end turn'}
            </button>
            {discardMode ? (
              <span className="muted tiny">Select a hand card, then a discard pile.</span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
