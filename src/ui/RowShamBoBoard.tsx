import { useEffect, useMemo, useRef, useState } from 'react'
import { fillRowShamBoBots } from '../ai/rowshamboBot'
import { cardLabel } from '../core/rowshambo/deck'
import { kindGlyph } from '../core/rowshambo/publicBoard'
import { applyRowShamBoMove } from '../core/rowshambo/rules'
import { ACTION_TIMEOUT_MS, createRowShamBoMatch } from '../core/rowshambo/state'
import type { RowShamBoCard, RowShamBoMove, RowShamBoState, RowShamBoVariant } from '../core/rowshambo/types'
import {
  directionLabel,
  MATCH_TARGETS,
  rowShamBoTip,
  rowShamBoVariantLabel,
} from '../core/rowshambo/variants'
import '../styles/rowshambo.css'

export type RowShamBoBoardController = {
  state: RowShamBoState
  localIndex: number
  submit: (move: RowShamBoMove) => { ok: true } | { ok: false; error: string }
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
}

type Props = {
  yourName: string
  variant: RowShamBoVariant
  playerCount?: number
  playTo?: number
  onExit: () => void
  controller?: RowShamBoBoardController | null
}

function assetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}assets/rowshambo/${file}`
}

function CardFace({
  card,
  selected,
  legal,
  disabled,
  onClick,
  faceDown,
}: {
  card?: RowShamBoCard | null
  selected?: boolean
  legal?: boolean
  disabled?: boolean
  onClick?: () => void
  faceDown?: boolean
}) {
  const [imgOk, setImgOk] = useState(true)
  if (faceDown || !card) {
    return (
      <div className="rsb-card is-back" aria-label="Face down">
        <span className="rsb-card-glyph" aria-hidden>
          ?
        </span>
        <span className="rsb-card-label">Hidden</span>
      </div>
    )
  }
  const src = assetUrl(`${card.kind}.png`)
  return (
    <button
      type="button"
      className={`rsb-card is-${card.kind}${selected ? ' is-selected' : ''}${legal ? ' is-legal' : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={cardLabel(card)}
    >
      {imgOk ? (
        <img
          className="rsb-card-face"
          src={src}
          alt=""
          onError={() => setImgOk(false)}
        />
      ) : (
        <>
          <span className="rsb-card-glyph" aria-hidden>
            {kindGlyph(card.kind)}
          </span>
          <span className="rsb-card-label">{cardLabel(card)}</span>
        </>
      )}
    </button>
  )
}

export function RowShamBoBoard({
  yourName,
  variant,
  playerCount = 2,
  playTo = 100,
  onExit,
  controller,
}: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<RowShamBoState | null>(null)
  const [err, setErr] = useState('')
  const [burst, setBurst] = useState<{ text: string; cls: string } | null>(null)
  const [now, setNow] = useState(Date.now())
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback
  const spinOnce = useRef(false)

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
    setFallback(createRowShamBoMatch(names, computers, variant, playTo))
  }, [controller, yourName, variant, playerCount, playTo])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  void tick
  const state = controller?.state ?? fallback
  const localIndex = controller?.localIndex ?? 0
  const you = state?.players[localIndex]

  const play = (move: RowShamBoMove) => {
    setErr('')
    if (controller) {
      const res = controller.submit(move)
      if (!res.ok) setErr(res.error)
      return
    }
    const cur = fallbackRef.current
    if (!cur) return
    const res = applyRowShamBoMove(cur, move)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    let next = res.state
    if (next.phase === 'pass' || next.phase === 'play') {
      next = fillRowShamBoBots(next)
    }
    setFallback(next)
    fallbackRef.current = next
  }

  // Auto-advance chooseDir after spin
  useEffect(() => {
    if (!state || state.phase !== 'chooseDir') {
      spinOnce.current = false
      return
    }
    if (spinOnce.current) return
    spinOnce.current = true
    const t = window.setTimeout(() => play({ t: 'ackDir' }), 1200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.handNumber])

  // Auto-advance resolve steps for comic pacing
  useEffect(() => {
    if (!state || state.phase !== 'resolve') {
      setBurst(null)
      return
    }
    const step = state.resolveSteps[state.resolveStepIndex]
    if (!step) return
    const cls =
      step.outcome === 'tie' ? 'is-tie' : step.outcome === 'nextWin' ? '' : 'is-oof'
    const text =
      step.outcome === 'tie' ? 'TIE!' : step.outcome === 'nextWin' ? 'POW!' : 'OOF!'
    setBurst({ text, cls })
    const t = window.setTimeout(() => play({ t: 'ackResolve' }), 1100)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.resolveStepIndex, state?.handNumber])

  // Human timeout
  useEffect(() => {
    if (!state?.actionDeadline) return
    if (state.phase !== 'pass' && state.phase !== 'play') return
    if (now < state.actionDeadline) return
    play({ t: 'timeout' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, state?.actionDeadline, state?.phase])

  const secsLeft = useMemo(() => {
    if (!state?.actionDeadline) return null
    return Math.max(0, Math.ceil((state.actionDeadline - now) / 1000))
  }, [state?.actionDeadline, now])

  if (!state || !you) {
    return (
      <div className="rsb-root">
        <p>Dealing…</p>
        <button type="button" className="rsb-btn ghost" onClick={onExit}>
          Quit
        </button>
      </div>
    )
  }

  const matchOver = state.phase === 'matchEnd'
  const gameOver = state.phase === 'gameEnd'
  const handOver = state.phase === 'handEnd'
  const canPick = (state.phase === 'pass' || state.phase === 'play') && !you.isComputer
  const waitingPass = state.phase === 'pass' && !you.passCardId && you.hand.length > 0
  const waitingPlay = state.phase === 'play' && !you.playCardId && you.hand.length > 0
  const prompt =
    state.phase === 'chooseDir'
      ? 'Randomizer!'
      : waitingPass
        ? 'Select a card to pass'
        : waitingPlay
          ? 'Select a card to play'
          : state.phase === 'resolve'
            ? state.lastMessage || 'Battle!'
            : state.lastMessage || rowShamBoTip(state.config.variant)

  return (
    <div className="rsb-root">
      <header className="rsb-head">
        <div>
          <h2 className="rsb-title">Row! Sham! Bo!</h2>
          <p className="rsb-sub">
            {rowShamBoVariantLabel(state.config.variant)} · to {state.config.playTo} · Hand{' '}
            {state.handNumber} · Game {state.gameNumber}
          </p>
        </div>
        <button type="button" className="rsb-btn ghost" onClick={onExit}>
          Quit
        </button>
      </header>

      <div className="rsb-scores" aria-label="Scores">
        {state.players.map((p, pi) => (
          <div
            key={p.id}
            className={`rsb-score-card${pi === state.button ? ' is-button' : ''}${
              matchOver && p.id === state.winnerId ? ' is-winner' : ''
            }`}
          >
            <span className="rsb-score-name">
              {p.name}
              {pi === localIndex ? ' (you)' : ''}
              {pi === state.button ? ' ★' : ''}
            </span>
            <span className="rsb-score-total">{p.matchScore}</span>
            <span className="rsb-score-delta">
              game {p.gameScore}
              {p.passCardId || p.playCardId ? ' · locked' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="rsb-arena" aria-label="Arena">
        {secsLeft != null && (waitingPass || waitingPlay) ? (
          <div className={`rsb-timer${secsLeft <= 10 ? ' is-warn' : ''}`}>{secsLeft}s</div>
        ) : null}
        {state.phase === 'resolve' && state.tablePlays.some(Boolean) ? (
          <div className="rsb-duel-row" aria-label="Table plays">
            {state.players.map((p, pi) => {
              const play = state.tablePlays[pi]
              if (!play) return null
              const faceUp = Boolean(state.revealed[pi])
              const step = state.resolveSteps[state.resolveStepIndex]
              const inDuel =
                step != null && (step.contested.includes(pi) || step.next === pi)
              return (
                <div
                  key={p.id}
                  className={`rsb-duel-slot${inDuel ? ' is-dueling' : ''}${pi === state.button ? ' is-button' : ''}`}
                >
                  <span className="rsb-duel-name">{p.name}</span>
                  <CardFace card={play} faceDown={!faceUp} disabled />
                </div>
              )
            })}
          </div>
        ) : (
          <div
            className={`rsb-dial${state.phase === 'chooseDir' ? ' is-spin' : ''}${
              state.direction === 'cw' ? ' is-cw' : state.direction === 'ccw' ? ' is-ccw' : ''
            }`}
          >
            <div className="rsb-dial-core">
              {state.direction ? directionLabel(state.direction) : '???'}
              <br />
              Stock {state.stock.length}
            </div>
          </div>
        )}
        <div className="rsb-prompt">{prompt}</div>
        {burst ? (
          <div className="rsb-burst" aria-hidden>
            <div className={`rsb-burst-stamp ${burst.cls}`}>{burst.text}</div>
          </div>
        ) : null}
      </div>

      {err ? <p className="error">{err}</p> : null}

      <div className="rsb-hand" aria-label="Your hand">
        {you.hand.map((c) => {
          const locked =
            (state.phase === 'pass' && you.passCardId === c.id) ||
            (state.phase === 'play' && you.playCardId === c.id)
          const interactive = canPick && (waitingPass || waitingPlay) && !you.passCardId && !you.playCardId
          return (
            <CardFace
              key={c.id}
              card={c}
              selected={locked}
              legal={interactive}
              disabled={!interactive}
              onClick={() => {
                if (waitingPass) play({ t: 'pass', cardId: c.id })
                else if (waitingPlay) play({ t: 'play', cardId: c.id })
              }}
            />
          )
        })}
      </div>

      <div className="rsb-actions">
        {handOver ? (
          <button type="button" className="rsb-btn primary" onClick={() => play({ t: 'ackHandEnd' })}>
            Next hand
          </button>
        ) : null}
        {gameOver ? (
          <button type="button" className="rsb-btn primary" onClick={() => play({ t: 'ackGameEnd' })}>
            Next game
          </button>
        ) : null}
        {matchOver && controller?.newMatch ? (
          <button type="button" className="rsb-btn primary" onClick={() => controller.newMatch?.()}>
            New match
          </button>
        ) : null}
      </div>

      <p className="rsb-tip">{rowShamBoTip(state.config.variant)} · Timeout {ACTION_TIMEOUT_MS / 1000}s</p>

      {matchOver ? (
        <div className="rsb-overlay">
          <div className="rsb-overlay-card is-epic">
            <h3>{state.matchTied ? 'Double KO!' : 'Victory!'}</h3>
            <p>
              {state.matchTied
                ? 'Match tied!'
                : `${state.players.find((p) => p.id === state.winnerId)?.name ?? 'Someone'} wins!`}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0', fontWeight: 800 }}>
              {[...state.players]
                .sort((a, b) => b.matchScore - a.matchScore)
                .map((p) => (
                  <li key={p.id}>
                    {p.name}: {p.matchScore}
                  </li>
                ))}
            </ul>
            <div className="rsb-actions">
              {controller?.newMatch ? (
                <button type="button" className="rsb-btn primary" onClick={() => controller.newMatch?.()}>
                  Rematch
                </button>
              ) : (
                <button
                  type="button"
                  className="rsb-btn primary"
                  onClick={() => {
                    const names = state.players.map((p) => p.name)
                    const computers = state.players.map((p) => p.isComputer)
                    setFallback(
                      createRowShamBoMatch(names, computers, variant, playTo, Date.now()),
                    )
                  }}
                >
                  Rematch
                </button>
              )}
              <button type="button" className="rsb-btn ghost" onClick={onExit}>
                Quit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gameOver && !matchOver ? (
        <div className="rsb-overlay">
          <div className="rsb-overlay-card">
            <h3>Game over!</h3>
            <p>{state.lastMessage}</p>
            <ul style={{ listStyle: 'none', padding: 0, fontWeight: 800 }}>
              {[...state.players]
                .sort((a, b) => b.gameScore - a.gameScore)
                .map((p) => (
                  <li key={p.id}>
                    {p.name}: game {p.gameScore} · match {p.matchScore}
                  </li>
                ))}
            </ul>
            <button type="button" className="rsb-btn primary" onClick={() => play({ t: 'ackGameEnd' })}>
              Next game (first to {state.config.playTo})
            </button>
          </div>
        </div>
      ) : null}

      {/* keep MATCH_TARGETS referenced for tree-shaking clarity in lobby */}
      <span hidden>{MATCH_TARGETS.join(',')}</span>
    </div>
  )
}
