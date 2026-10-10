import { useEffect, useMemo, useState } from 'react'
import { pumpIchiBots } from '../ai/ichiBot'
import { colorLabel, kindLabel, ICHI_COLORS, sortIchiHand } from '../core/ichi/deck'
import { applyIchiMove, legalPlays } from '../core/ichi/rules'
import { createIchiMatch, dealNextIchiRound, topCard } from '../core/ichi/state'
import type { IchiCard, IchiColor, IchiMove, IchiState, IchiVariant } from '../core/ichi/types'
import { ichiVariantLabel } from '../core/ichi/variants'

export type IchiBoardController = {
  state: IchiState
  localIndex: number
  aiThinking?: boolean
  submit: (move: IchiMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
}

type Props = {
  yourName: string
  variant: IchiVariant
  playerCount?: number
  onExit: () => void
  controller?: IchiBoardController | null
}

const COLOR_CSS: Record<IchiColor, string> = {
  R: '#b33a2b',
  Y: '#c9a227',
  G: '#2a7a4b',
  B: '#2a5f8f',
}

function IchiCardFace({
  card,
  size = 'md',
  dimmed,
  legal,
  onClick,
}: {
  card: IchiCard
  size?: 'md' | 'lg'
  dimmed?: boolean
  legal?: boolean
  onClick?: () => void
}) {
  const bg = card.color ? COLOR_CSS[card.color] : '#1e2a33'
  const label = kindLabel(card.kind)
  const cls = `ichi-face is-${size}${dimmed ? ' is-dim' : ''}${legal ? ' is-legal' : ''}${onClick ? ' is-clickable' : ''}`
  const aria = `${label}${card.color ? ` ${colorLabel(card.color)}` : ' wild'}`
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

function phaseTip(state: IchiState): string {
  if (state.phase === 'colorPick') return 'Name the next color for the table.'
  if (state.phase === 'challenge') {
    return 'Wild Draw Four: accept (draw 4) or challenge if you think they held the prior color.'
  }
  if (state.drawnPlayableId) return 'You drew a playable card — play it, or Pass to keep it and end your turn.'
  return 'Match the discard color or symbol. Wild always works. Call Ichi when you play down to one card.'
}

export function IchiBoard({ yourName, variant, playerCount = 4, onExit, controller }: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<IchiState | null>(null)
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
    const names = [yourName || 'You', 'Computer 1', 'Computer 2', 'Computer 3'].slice(0, playerCount)
    const computers = names.map((_, i) => i > 0)
    let cancelled = false
    let cur = createIchiMatch(names, computers, variant)
    setFallback(cur)
    void (async () => {
      setAiThinking(true)
      cur = await pumpIchiBots(cur, {
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

  const actor =
    state?.phase === 'colorPick' && state.colorPicker != null
      ? state.colorPicker
      : state?.phase === 'challenge' && state.challengeTarget != null
        ? state.challengeTarget
        : state?.current
  const yourTurn = state != null && actor === localIndex
  const actingName = state?.players[actor ?? 0]?.name ?? 'Someone'

  const legal = useMemo(
    () => (state && yourTurn && state.phase === 'play' ? legalPlays(state, localIndex) : []),
    [state, yourTurn, localIndex, tick],
  )
  const legalIds = new Set(legal.map((c) => c.id))

  const play = (move: IchiMove) => {
    setErr('')
    if (controller) {
      const res = controller.submit(move)
      if (!res.ok) setErr(res.error)
      return
    }
    if (!fallback) return
    const res = applyIchiMove(fallback, move)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setFallback(res.state)
    void pumpIchiBots(res.state, {
      isCancelled: () => false,
      onThinking: setAiThinking,
      onStep: (next) => setFallback(next),
    }).then((next) => setFallback(next))
  }

  if (!state || !you) {
    return (
      <div className="shell-game ichi-board">
        <p className="muted">Dealing…</p>
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
      </div>
    )
  }

  const top = topCard(state)
  const status =
    thinking && !yourTurn
      ? `${actingName} is thinking…`
      : state.lastMessage || phaseTip(state)
  const ranked = [...state.players].sort((a, b) => b.score - a.score)
  const leaderId = ranked[0]?.id
  const handScoreById = new Map((state.lastHandScores ?? []).map((l) => [l.playerId, l]))
  const playTo = state.config.playTo
  const orderedHand = sortIchiHand(you.hand)

  return (
    <div className={`shell-game ichi-board rummy-board${yourTurn ? ' is-your-turn' : ''}`}>
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
        <div>
          <h2>
            {ichiVariantLabel(variant)} · {state.players.length} players
          </h2>
          <p className="muted">
            Hand {state.round}
            {playTo != null ? ` · first to ${playTo}` : ''}
            {` · ${colorLabel(state.currentColor)}`}
            {state.direction === 1 ? ' · clockwise' : ' · counter-clockwise'}
          </p>
          <p className="rummy-tip">
            Match color or symbol on the discard. Skip / Reverse / +2 hit the next player. Wild picks
            color; Wild +4 can be challenged. Empty your hand — call <strong>Ichi</strong> at one
            card.
          </p>
        </div>
      </header>

      <div
        className={`rummy-turn-banner is-${yourTurn ? 'you' : thinking ? 'wait' : 'other'}`}
        role="status"
      >
        <strong>
          {thinking && !yourTurn
            ? 'Computers are thinking…'
            : yourTurn
              ? state.phase === 'colorPick'
                ? 'Choose a color'
                : state.phase === 'challenge'
                  ? 'Accept or challenge +4'
                  : 'Your turn'
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
          const isTheirTurn = !roundOver && !matchOver && actor === pi
          return (
            <div
              key={p.id}
              className={`rummy-score-card${isLeader ? ' is-leader' : ''}${isWinner ? ' is-winner' : ''}${isTheirTurn ? ' is-turn' : ''}`}
            >
              <span className="rummy-score-name">
                {p.name}
                {pi === localIndex ? ' (you)' : ''}
                {isWinner ? ' — wins' : isLeader && !matchOver ? ' · lead' : ''}
                {state.ichiCalled[pi] && p.hand.length === 1 ? ' · Ichi!' : ''}
              </span>
              <span className="rummy-score-total">{p.score}</span>
              {roundOver || matchOver ? (
                <span className="rummy-score-delta">
                  {line ? `${line.delta > 0 ? '+' : ''}${line.delta} this hand` : '—'}
                </span>
              ) : (
                <span className="rummy-score-delta">
                  {p.hand.length} card{p.hand.length === 1 ? '' : 's'}
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
                  else setFallback(dealNextIchiRound(state))
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
                  setFallback(
                    createIchiMatch(
                      state.players.map((p) => p.name),
                      state.players.map((p) => p.isComputer),
                      variant,
                    ),
                  )
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

      <div className="trick-current ichi-table" aria-label="Ichi table">
        <span className="pile-label">
          Color {colorLabel(state.currentColor)}
          {state.direction === 1 ? ' · clockwise' : ' · counter-clockwise'}
          {` · stock ${state.stock.length}`}
        </span>
        <div className="rummy-piles ichi-piles">
          <div className="rummy-pile" aria-label="Stock">
            <span className="pile-label">Stock</span>
            <div className="ichi-face is-lg is-back">
              <span className="ichi-face-center">{state.stock.length}</span>
            </div>
          </div>
          <div className="rummy-pile" aria-label="Discard">
            <span className="pile-label">Discard</span>
            {top ? (
              <IchiCardFace card={top} size="lg" />
            ) : (
              <div className="ichi-face is-lg is-empty">—</div>
            )}
          </div>
          <div
            className="ichi-color-badge"
            style={{ borderColor: COLOR_CSS[state.currentColor] }}
            aria-label={`Current color ${colorLabel(state.currentColor)}`}
          >
            <span
              className="ichi-color-swatch"
              style={{ background: COLOR_CSS[state.currentColor] }}
            />
            <strong>{colorLabel(state.currentColor)}</strong>
          </div>
        </div>
        <p className="muted tiny">{phaseTip(state)}</p>
      </div>

      <div className={`rummy-hand${yourTurn ? ' is-active' : ''}`} aria-label="Your hand">
        {orderedHand.map((c) => {
          const can = yourTurn && state.phase === 'play' && legalIds.has(c.id)
          const illegal = yourTurn && state.phase === 'play' && !can
          return (
            <button
              key={c.id}
              type="button"
              className={`rummy-hand-slot ichi-hand-slot${illegal ? ' is-illegal' : ''}${can ? ' is-legal-slot' : ''}`}
              disabled={!can}
              onClick={() => play({ t: 'play', cardId: c.id })}
            >
              <IchiCardFace card={c} size="md" dimmed={illegal} legal={can} />
            </button>
          )
        })}
      </div>
      <p className="muted tiny rummy-hand-hint">
        Highlighted cards are legal plays · Tap one to discard it
        {you.hand.length === 1 ? ' · Don’t forget Call Ichi!' : ''}
      </p>

      <div className="rummy-actions">
        {!roundOver && !matchOver && state.phase === 'play' && yourTurn ? (
          <>
            <button
              type="button"
              className="btn secondary"
              disabled={legal.length > 0 && !state.drawnPlayableId}
              onClick={() => play(state.drawnPlayableId ? { t: 'pass' } : { t: 'draw' })}
            >
              {state.drawnPlayableId ? 'Pass (keep drawn card)' : 'Draw from stock'}
            </button>
            {(you.hand.length === 1 || state.ichiPending === localIndex) &&
            !state.ichiCalled[localIndex] ? (
              <button type="button" className="btn primary" onClick={() => play({ t: 'callIchi' })}>
                Call Ichi!
              </button>
            ) : null}
          </>
        ) : null}

        {!roundOver && !matchOver && state.phase === 'colorPick' && yourTurn ? (
          <>
            <span className="muted">Name the color:</span>
            {ICHI_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="btn primary ichi-color-btn"
                style={{ background: COLOR_CSS[c], borderColor: COLOR_CSS[c] }}
                onClick={() => play({ t: 'chooseColor', color: c })}
              >
                {colorLabel(c)}
              </button>
            ))}
          </>
        ) : null}

        {!roundOver && !matchOver && state.phase === 'challenge' && yourTurn ? (
          <>
            <button type="button" className="btn secondary" onClick={() => play({ t: 'acceptWdf' })}>
              Draw 4 (accept)
            </button>
            <button type="button" className="btn primary" onClick={() => play({ t: 'challenge' })}>
              Challenge +4
            </button>
          </>
        ) : null}
      </div>

      <p className="muted tiny">{state.log.slice(-3).join(' · ')}</p>
    </div>
  )
}
