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

/** Pacing — keep readable on MoAP / HUD. */
const DIR_SPIN_MS = 2800
const PRE_DUEL_MS = 2000
/** Let flipped cards sit before POW/OOF/TIE. */
const REVEAL_PAUSE_MS = 1000
const BURST_HOLD_MS = 2000
const DUEL_HOLD_MS = REVEAL_PAUSE_MS + BURST_HOLD_MS + 600
/** Auto-advance after a round ends. */
const ROUND_COUNTDOWN_SEC = 3

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

type CompassPoint = 's' | 'w' | 'n' | 'e'

/** Seat the local player at south; walk CW around the table for the rest. */
function compassForPlayer(
  playerIndex: number,
  localIndex: number,
  seats: number[],
): CompassPoint {
  if (playerIndex === localIndex) return 's'
  if (seats.length === 2) return 'n'
  const localSeat = seats[localIndex] ?? localIndex
  const seat = seats[playerIndex] ?? playerIndex
  const rel = (((seat - localSeat) % 4) + 4) % 4
  return (['s', 'w', 'n', 'e'] as const)[rel] ?? 'n'
}

function duelResultForSeat(
  step: { contested: number[]; next: number; outcome: string; deltas: { seat: number; delta: number }[] } | null,
  playerIndex: number,
): { kind: 'win' | 'lose' | 'tie' | 'idle'; label: string } {
  if (!step) return { kind: 'idle', label: '' }
  const inContested = step.contested.includes(playerIndex)
  const isNext = step.next === playerIndex
  if (!inContested && !isNext) return { kind: 'idle', label: '' }
  if (step.outcome === 'tie') return { kind: 'tie', label: 'TIE' }
  if (step.outcome === 'contestedWin') {
    if (inContested) {
      const pts = step.deltas.find((d) => d.seat === playerIndex)?.delta ?? 1
      return { kind: 'win', label: pts > 1 ? `WIN +${pts}` : 'WIN +1' }
    }
    return { kind: 'lose', label: 'OUT' }
  }
  // nextWin
  if (isNext) {
    const pts = step.deltas.find((d) => d.seat === playerIndex)?.delta ?? 1
    return { kind: 'win', label: pts > 1 ? `WIN +${pts}` : 'WIN' }
  }
  return { kind: 'lose', label: 'OUT' }
}

function CardFace({
  card,
  selected,
  legal,
  received,
  disabled,
  onClick,
  faceDown,
  size = 'md',
}: {
  card?: RowShamBoCard | null
  selected?: boolean
  legal?: boolean
  /** Just arrived from the once-per-game pass. */
  received?: boolean
  disabled?: boolean
  onClick?: () => void
  faceDown?: boolean
  size?: 'md' | 'lg'
}) {
  const [imgOk, setImgOk] = useState(true)
  const [backOk, setBackOk] = useState(true)
  const sizeCls = size === 'lg' ? ' is-lg' : ''
  if (faceDown || !card) {
    return (
      <div className={`rsb-card is-back${backOk ? ' has-art' : ''}${sizeCls}`} aria-label="Face down">
        {backOk ? (
          <img
            className="rsb-card-face"
            src={assetUrl('card-back.png')}
            alt=""
            onError={() => setBackOk(false)}
          />
        ) : (
          <>
            <span className="rsb-card-glyph" aria-hidden>
              ?
            </span>
            <span className="rsb-card-label">Hidden</span>
          </>
        )}
      </div>
    )
  }
  const src = assetUrl(`${card.kind}.png`)
  return (
    <button
      type="button"
      className={`rsb-card is-${card.kind}${imgOk ? ' has-art' : ''}${selected ? ' is-selected' : ''}${legal ? ' is-legal' : ''}${received ? ' is-received' : ''}${sizeCls}`}
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
  const [burst, setBurst] = useState<{ text: string; cls: string; img: string } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [roundEndAt, setRoundEndAt] = useState<number | null>(null)
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback
  const spinOnce = useRef(false)
  const playRef = useRef<(move: RowShamBoMove) => void>(() => {})
  const timedOutDeadlineRef = useRef<number | null>(null)
  /** `${gameNumber}:${handNumber}` — once per handEnd, never across games. */
  const handEndAckedKeyRef = useRef<string | null>(null)
  const handEndArmedKeyRef = useRef<string | null>(null)

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
  playRef.current = play

  // Auto-advance chooseDir after spin
  useEffect(() => {
    if (!state || state.phase !== 'chooseDir') {
      spinOnce.current = false
      return
    }
    if (spinOnce.current) return
    spinOnce.current = true
    const t = window.setTimeout(() => playRef.current({ t: 'ackDir' }), DIR_SPIN_MS)
    return () => window.clearTimeout(t)
  }, [state?.phase, state?.handNumber])

  // Auto-advance resolve: face-down beat, then each duel held so flips + bursts read clearly
  useEffect(() => {
    if (!state || state.phase !== 'resolve') {
      setBurst(null)
      return
    }
    // Preamble: all cards still face-down
    if (state.resolveStepIndex < 0) {
      setBurst(null)
      const t = window.setTimeout(() => playRef.current({ t: 'ackResolve' }), PRE_DUEL_MS)
      return () => window.clearTimeout(t)
    }
    const step = state.resolveSteps[state.resolveStepIndex]
    if (!step) return
    // One center stamp; per-card WIN/OUT badges carry who actually won or lost.
    const cls = step.outcome === 'tie' ? 'is-tie' : ''
    const text = step.outcome === 'tie' ? 'TIE!' : 'POW!'
    const img = step.outcome === 'tie' ? 'burst-tie.png' : 'burst-pow.png'
    // Cards flip with the resolve step — hold them face-up before the result stamp.
    setBurst(null)
    const burstT = window.setTimeout(() => {
      setBurst({ text, cls, img })
    }, REVEAL_PAUSE_MS)
    const clearT = window.setTimeout(() => setBurst(null), REVEAL_PAUSE_MS + BURST_HOLD_MS)
    const t = window.setTimeout(() => playRef.current({ t: 'ackResolve' }), DUEL_HOLD_MS)
    return () => {
      window.clearTimeout(burstT)
      window.clearTimeout(clearT)
      window.clearTimeout(t)
    }
  }, [state?.phase, state?.resolveStepIndex])

  // Human timeout — once per deadline only (never a multi-fire auto-play loop)
  useEffect(() => {
    if (!state?.actionDeadline) return
    if (state.phase !== 'pass' && state.phase !== 'play') {
      timedOutDeadlineRef.current = null
      return
    }
    if (now < state.actionDeadline) return
    if (timedOutDeadlineRef.current === state.actionDeadline) return
    timedOutDeadlineRef.current = state.actionDeadline
    playRef.current({ t: 'timeout' })
  }, [now, state?.actionDeadline, state?.phase])

  // Auto next round: arm a 3s end time once per handEnd (no setInterval storms)
  useEffect(() => {
    if (!state || state.phase !== 'handEnd') {
      setRoundEndAt(null)
      handEndArmedKeyRef.current = null
      return
    }
    const key = `${state.gameNumber}:${state.handNumber}`
    if (handEndAckedKeyRef.current === key) return
    if (handEndArmedKeyRef.current === key) return
    handEndArmedKeyRef.current = key
    setRoundEndAt(Date.now() + ROUND_COUNTDOWN_SEC * 1000)
  }, [state?.phase, state?.gameNumber, state?.handNumber])

  useEffect(() => {
    if (roundEndAt == null || !state || state.phase !== 'handEnd') return
    if (now < roundEndAt) return
    const key = `${state.gameNumber}:${state.handNumber}`
    if (handEndAckedKeyRef.current === key) return
    handEndAckedKeyRef.current = key
    setRoundEndAt(null)
    playRef.current({ t: 'ackHandEnd' })
  }, [now, roundEndAt, state?.phase, state?.gameNumber, state?.handNumber])

  const roundCountdown =
    roundEndAt != null && state?.phase === 'handEnd'
      ? Math.max(1, Math.ceil((roundEndAt - now) / 1000))
      : null

  const secsLeft = useMemo(() => {
    if (!state?.actionDeadline) return null
    if (state.phase !== 'pass' && state.phase !== 'play') return null
    return Math.max(0, Math.ceil((state.actionDeadline - now) / 1000))
  }, [state?.actionDeadline, state?.phase, now])

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
  const receivedCard = you.receivedCardId
    ? you.hand.find((c) => c.id === you.receivedCardId) ?? null
    : null
  const prompt =
    state.phase === 'chooseDir'
      ? 'Randomizer!'
      : waitingPass
        ? 'Pass 1 card (once this game)'
        : waitingPlay && receivedCard
          ? `You received ${cardLabel(receivedCard)} — select a card to play`
          : waitingPlay
            ? 'Select a card to play'
            : state.phase === 'resolve'
              ? state.resolveStepIndex < 0
                ? 'Cards are down — get ready…'
                : `Duel ${state.resolveStepIndex + 1} of ${state.resolveSteps.length}`
              : state.phase === 'handEnd'
                ? roundCountdown != null
                  ? `Round over — next round in ${roundCountdown}`
                  : 'Round over…'
                : state.lastMessage || rowShamBoTip(state.config.variant)

  return (
    <div className="rsb-root">
      <header className="rsb-head">
        <div>
          <h2 className="rsb-title">Row! Sham! Bo!</h2>
          <p className="rsb-sub">
            {rowShamBoVariantLabel(state.config.variant)} · to {state.config.playTo} · Round{' '}
            {Math.max(1, state.handNumber)} · Game {state.gameNumber}
            {state.direction ? ` · ${directionLabel(state.direction)}` : ''}
          </p>
        </div>
        <button type="button" className="rsb-btn ghost" onClick={onExit}>
          Quit
        </button>
      </header>

      <div className="rsb-stage">
        <div className="rsb-arena" aria-label="Arena">
          {secsLeft != null && (waitingPass || waitingPlay) ? (
            <div className={`rsb-timer${secsLeft <= 10 ? ' is-warn' : ''}`}>{secsLeft}s</div>
          ) : null}
          {state.phase === 'resolve' && state.tablePlays.some(Boolean) ? (
            <div
              className={`rsb-duel-table${state.direction === 'cw' ? ' is-cw' : state.direction === 'ccw' ? ' is-ccw' : ''}`}
              aria-label="Table plays"
            >
              {state.players.map((p, pi) => {
                const tableCard = state.tablePlays[pi]
                if (!tableCard) return null
                const faceUp = Boolean(state.revealed[pi])
                const step =
                  state.resolveStepIndex >= 0
                    ? state.resolveSteps[state.resolveStepIndex]
                    : null
                const inDuel =
                  step != null && (step.contested.includes(pi) || step.next === pi)
                const result = burst && step ? duelResultForSeat(step, pi) : { kind: 'idle' as const, label: '' }
                const compass = compassForPlayer(
                  pi,
                  localIndex,
                  state.players.map((pl) => pl.seat),
                )
                return (
                  <div
                    key={p.id}
                    className={`rsb-duel-slot is-${compass}${inDuel ? ' is-dueling' : ' is-sideline'}${
                      pi === state.button ? ' is-button' : ''
                    }${pi === localIndex ? ' is-you' : ''}${result.kind !== 'idle' ? ` is-${result.kind}` : ''}`}
                  >
                    <span className="rsb-duel-name">
                      {pi === state.button ? '★ ' : ''}
                      {p.name}
                      {pi === localIndex ? ' (you)' : ''}
                    </span>
                    <div className="rsb-duel-card-wrap">
                      <CardFace card={tableCard} faceDown={!faceUp} disabled size="lg" />
                      {result.kind !== 'idle' ? (
                        <span className={`rsb-duel-badge is-${result.kind}`}>{result.label}</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              <div className="rsb-duel-center" aria-hidden>
                {burst ? (
                  <div className="rsb-burst is-center">
                    <img
                      className={`rsb-burst-img ${burst.cls}`}
                      src={assetUrl(burst.img)}
                      alt={burst.text}
                      onError={(e) => {
                        const el = e.currentTarget
                        el.style.display = 'none'
                        const fallback = el.nextElementSibling as HTMLElement | null
                        if (fallback) fallback.hidden = false
                      }}
                    />
                    <div className={`rsb-burst-stamp ${burst.cls}`} hidden>
                      {burst.text}
                    </div>
                  </div>
                ) : (
                  <div className="rsb-duel-hub">
                    <span className="rsb-duel-hub-dir">
                      {state.direction ? directionLabel(state.direction) : 'Fight!'}
                    </span>
                    {state.resolveStepIndex >= 0 ? (
                      <span className="rsb-duel-hub-step">
                        Duel {state.resolveStepIndex + 1}/{state.resolveSteps.length}
                      </span>
                    ) : (
                      <span className="rsb-duel-hub-step">Cards down…</span>
                    )}
                  </div>
                )}
              </div>
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
        </div>

        <aside className="rsb-scoreboard" aria-label="Scoreboard">
          <div className="rsb-scoreboard-head">
            <span>Scoreboard</span>
            <em>to {state.config.playTo}</em>
          </div>
          <div className="rsb-scoreboard-cols" aria-hidden>
            <span />
            <span>Game</span>
            <span>Match</span>
          </div>
          <ol className="rsb-scoreboard-list">
            {state.players.map((p, pi) => (
              <li
                key={p.id}
                className={`rsb-score-row${pi === localIndex ? ' is-you' : ''}${
                  pi === state.button ? ' is-button' : ''
                }${matchOver && p.id === state.winnerId ? ' is-winner' : ''}`}
              >
                <span className="rsb-score-name">
                  {pi === state.button ? '★ ' : ''}
                  {p.name}
                  {pi === localIndex ? ' (you)' : ''}
                  {p.passCardId || p.playCardId ? (
                    <small className="rsb-score-lock"> locked</small>
                  ) : null}
                </span>
                <span className="rsb-score-game">{p.gameScore}</span>
                <span className="rsb-score-match">{p.matchScore}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {err ? <p className="error">{err}</p> : null}

      <div className="rsb-hand" aria-label="Your hand">
        {you.hand.map((c) => {
          const locked =
            (state.phase === 'pass' && you.passCardId === c.id) ||
            (state.phase === 'play' && you.playCardId === c.id)
          const isReceived = you.receivedCardId === c.id
          const interactive = canPick && (waitingPass || waitingPlay) && !you.passCardId && !you.playCardId
          return (
            <div
              key={c.id}
              className={`rsb-hand-slot${isReceived ? ' is-received' : ''}`}
            >
              <CardFace
                card={c}
                selected={locked}
                legal={interactive}
                received={isReceived}
                disabled={!interactive}
                onClick={() => {
                  if (waitingPass) play({ t: 'pass', cardId: c.id })
                  else if (waitingPlay) play({ t: 'play', cardId: c.id })
                }}
              />
              {isReceived ? (
                <span className="rsb-hand-new" aria-label={`Received ${cardLabel(c)}`}>
                  New · {cardLabel(c)}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="rsb-actions">
        {handOver && roundCountdown != null ? (
          <div className="rsb-countdown" aria-live="polite">
            Next round in <strong key={roundCountdown}>{roundCountdown}</strong>
          </div>
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
