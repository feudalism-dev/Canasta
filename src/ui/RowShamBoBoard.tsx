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
  rowShamBoBeatKey,
  rowShamBoTip,
  rowShamBoVariantLabel,
} from '../core/rowshambo/variants'
import '../styles/rowshambo.css'

/** Pacing — keep readable on MoAP / HUD. */
const DIR_SPIN_MS = 2800
/** All cards face-down before duel 1. */
const PRE_DUEL_MS = 2200
/** After a result, soak before we even flip the next challenger. */
const BETWEEN_DUELS_MS = 1600
/** Hold face-up cards before POW/OOF/TIE. */
const REVEAL_PAUSE_MS = 1100
/** How long the center stamp stays up. */
const BURST_HOLD_MS = 2200
/** Beat after the stamp before ack → next duel / hand end. */
const POST_BURST_MS = 800
/** Let POW/OOF/TIE + scores soak in before the next-round countdown. */
const POST_HAND_DWELL_MS = 4500
/** 3…2…1 after the dwell, then advance. */
const ROUND_COUNTDOWN_SEC = 3

export type RowShamBoBoardController = {
  state: RowShamBoState
  localIndex: number
  submit: (move: RowShamBoMove) => { ok: true } | { ok: false; error: string }
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
  /** Host/solo only — guests must not ackResolve or duels double-advance. */
  pacesResolve?: boolean
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

/**
 * Seat the local player at south. Parlor chairs: +1 = right (east), +2 = opposite,
 * +3 = left (west). Top-down clockwise from south walks west (left) first.
 */
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
  return (['s', 'e', 'n', 'w'] as const)[rel] ?? 'n'
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
  /** Only deadlines we observed while still in the future may auto-timeout. */
  const armedDeadlineRef = useRef<number | null>(null)
  /** Active resolve pacing key — survives Strict Mode remounts for the same stage. */
  const pacingKeyRef = useRef<string>('')
  const pacingTimersRef = useRef<number[]>([])
  const pacingRunRef = useRef(0)
  const ackedResolveKeysRef = useRef<Set<string>>(new Set())
  /** `${gameNumber}:${handNumber}` — once per handEnd, never across games. */
  const handEndAckedKeyRef = useRef<string | null>(null)
  const handEndArmedKeyRef = useRef<string | null>(null)

  const clearPacingTimers = () => {
    for (const id of pacingTimersRef.current) window.clearTimeout(id)
    pacingTimersRef.current = []
  }

  // Subscribe once per session object — do not re-bind when App rebuilds the controller wrapper.
  const onChange = controller?.onChange
  useEffect(() => {
    if (!onChange) return
    return onChange(() => setTick((t) => t + 1))
  }, [onChange])

  useEffect(() => {
    if (controller) {
      setFallback(null)
      return
    }
    const names = [yourName || 'You', 'Computer 1', 'Computer 2', 'Computer 3'].slice(0, playerCount)
    const computers = names.map((_, i) => i > 0)
    setFallback(createRowShamBoMatch(names, computers, variant, playTo))
    // Only re-deal when solo fallback mode / roster changes — not every controller wrapper rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller == null, yourName, variant, playerCount, playTo])

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

  // Auto-advance resolve one stage at a time (preamble → flip → POW/OOF/TIE → next).
  // Strict Mode safe: cleanup does not kill an in-flight run for the same pace key.
  useEffect(() => {
    if (!state || state.phase !== 'resolve') {
      pacingRunRef.current += 1
      clearPacingTimers()
      pacingKeyRef.current = ''
      ackedResolveKeysRef.current.clear()
      setBurst(null)
      return
    }

    const stepIndex = state.resolveStepIndex
    const sub = state.resolveSubphase ?? 'idle'
    const paceKey = `${state.gameNumber}:${state.handNumber}:${stepIndex}:${sub}`
    const shouldAck = controller?.pacesResolve !== false

    // Already running this exact stage — keep timers (re-render / Strict Mode).
    if (pacingKeyRef.current === paceKey) return

    pacingRunRef.current += 1
    const runId = pacingRunRef.current
    pacingKeyRef.current = paceKey
    clearPacingTimers()
    if (sub !== 'result') setBurst(null)

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms)
        pacingTimersRef.current.push(id)
      })

    const stillThisRun = () =>
      runId === pacingRunRef.current && pacingKeyRef.current === paceKey

    const ackOnce = () => {
      if (!shouldAck) return
      if (ackedResolveKeysRef.current.has(paceKey)) return
      ackedResolveKeysRef.current.add(paceKey)
      playRef.current({ t: 'ackResolve' })
    }

    ;(async () => {
      // Preamble: all cards face-down
      if (stepIndex < 0 || sub === 'idle') {
        await sleep(PRE_DUEL_MS)
        if (!stillThisRun()) return
        ackOnce()
        return
      }

      const step = state.resolveSteps[stepIndex]
      if (!step) return

      if (sub === 'challengerDown') {
        // Soak, then flip challenger via ack (core applies result + scores).
        await sleep(stepIndex === 0 ? 400 : BETWEEN_DUELS_MS)
        if (!stillThisRun()) return
        await sleep(REVEAL_PAUSE_MS)
        if (!stillThisRun()) return
        ackOnce()
        return
      }

      // result — hold POW/OOF/TIE before advancing
      const cls =
        step.outcome === 'tie' ? 'is-tie' : step.outcome === 'contestedWin' ? 'is-oof' : ''
      const text =
        step.outcome === 'tie' ? 'TIE!' : step.outcome === 'contestedWin' ? 'OOF!' : 'POW!'
      const img =
        step.outcome === 'tie'
          ? 'burst-tie.png'
          : step.outcome === 'contestedWin'
            ? 'burst-oof.png'
            : 'burst-pow.png'
      setBurst({ text, cls, img })
      await sleep(BURST_HOLD_MS)
      if (!stillThisRun()) return
      await sleep(POST_BURST_MS)
      if (!stillThisRun()) return
      setBurst(null)
      ackOnce()
    })()

    return () => {
      // Defer abort so Strict Mode remount of the same key keeps the run alive.
      const keyAtCleanup = paceKey
      queueMicrotask(() => {
        if (pacingKeyRef.current !== keyAtCleanup) {
          // Stage actually changed — drop orphaned timers from the old run.
          return
        }
        // Same key remounted: do not bump pacingRunRef or clear timers.
      })
    }
  }, [
    state?.phase,
    state?.resolveStepIndex,
    state?.resolveSubphase,
    state?.gameNumber,
    state?.handNumber,
    controller?.pacesResolve,
  ])

  // Human timeout — full ACTION_TIMEOUT_MS window; never fire on a deadline we never armed
  useEffect(() => {
    if (state?.phase !== 'pass' && state?.phase !== 'play') {
      timedOutDeadlineRef.current = null
      armedDeadlineRef.current = null
      return
    }
    const dl = state?.actionDeadline
    if (dl == null || !Number.isFinite(dl)) return
    // Arm only while the window is still open (blocks instant fire on stale/expired dl).
    if (now < dl) {
      armedDeadlineRef.current = dl
      return
    }
    if (armedDeadlineRef.current !== dl) return
    if (timedOutDeadlineRef.current === dl) return
    timedOutDeadlineRef.current = dl
    playRef.current({ t: 'timeout' })
  }, [now, state?.actionDeadline, state?.phase])

  // Auto next round: dwell on results, then 3…2…1 (once per handEnd)
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
    setRoundEndAt(Date.now() + POST_HAND_DWELL_MS + ROUND_COUNTDOWN_SEC * 1000)
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

  const roundMsLeft =
    roundEndAt != null && state?.phase === 'handEnd' ? Math.max(0, roundEndAt - now) : null
  // Countdown digits only in the final 3s; dwell shows results without ticking.
  const roundCountdown =
    roundMsLeft != null && roundMsLeft <= ROUND_COUNTDOWN_SEC * 1000
      ? Math.max(1, Math.ceil(roundMsLeft / 1000))
      : null
  const roundDwelling = roundMsLeft != null && roundCountdown == null

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
  const othersStillOpen = state.players.some((p, i) => {
    if (i === localIndex || !p.hand.length) return false
    if (state.phase === 'pass') return !p.passCardId
    if (state.phase === 'play') return !p.playCardId
    return false
  })
  const lockedWaitingOthers =
    othersStillOpen &&
    ((state.phase === 'pass' && Boolean(you.passCardId)) ||
      (state.phase === 'play' && Boolean(you.playCardId)))
  const waitedSecs =
    secsLeft != null ? Math.max(0, ACTION_TIMEOUT_MS / 1000 - secsLeft) : 0
  const showWaitingOthers = lockedWaitingOthers && waitedSecs >= 10
  const showTimer =
    secsLeft != null && (waitingPass || waitingPlay || lockedWaitingOthers)
  const receivedCard = you.receivedCardId
    ? you.hand.find((c) => c.id === you.receivedCardId) ?? null
    : null
  const beatKey = rowShamBoBeatKey(state.config.variant)
  const prompt = showWaitingOthers
    ? 'Waiting on other player(s)…'
    : state.phase === 'chooseDir'
      ? 'Randomizer!'
      : waitingPass
        ? 'Pass 1 card (once this game)'
        : waitingPlay && receivedCard
          ? `You received ${cardLabel(receivedCard)} — select a card to play`
          : waitingPlay
            ? 'Select a card to play'
            : lockedWaitingOthers
              ? 'Locked in — waiting…'
              : state.phase === 'resolve'
                ? state.resolveStepIndex < 0
                  ? 'Cards are down — get ready…'
                  : `Duel ${state.resolveStepIndex + 1} of ${state.resolveSteps.length}`
                : state.phase === 'handEnd'
                  ? roundCountdown != null
                    ? `Round over — next round in ${roundCountdown}`
                    : roundDwelling
                      ? state.lastMessage
                        ? `Round over — ${state.lastMessage}`
                        : 'Round over — check the scores'
                      : 'Round over…'
                  : state.lastMessage || rowShamBoTip(state.config.variant)

  return (
    <div className={`rsb-root${state.config.variant === 'elements' ? ' is-elements' : ''}`}>
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
        <aside className="rsb-beat-key" aria-label="What beats what">
          <div className="rsb-beat-key-head">Beat key</div>
          <ul className="rsb-beat-key-list">
            {beatKey.map((row) => (
              <li key={row.kind} className={`rsb-beat-row is-${row.kind.toLowerCase()}`}>
                <strong>{row.kind}</strong>
                <span>beats {row.beats}</span>
                {row.note ? <em>{row.note}</em> : null}
              </li>
            ))}
          </ul>
        </aside>

        <div className="rsb-arena" aria-label="Arena">
          {showTimer ? (
            <div className={`rsb-timer${secsLeft != null && secsLeft <= 10 ? ' is-warn' : ''}`}>
              {secsLeft}s
            </div>
          ) : null}
          {state.phase === 'resolve' && state.tablePlays.some(Boolean) ? (
            <div
              className={`rsb-duel-table${state.direction === 'cw' ? ' is-cw' : state.direction === 'ccw' ? ' is-ccw' : ''}`}
              aria-label="Table plays"
            >
              {state.players.map((p, pi) => {
                const tableCard = state.tablePlays[pi]
                if (!tableCard) return null
                const step =
                  state.resolveStepIndex >= 0
                    ? state.resolveSteps[state.resolveStepIndex]
                    : null
                const inContested = Boolean(step?.contested.includes(pi))
                const isChallenger = Boolean(step && step.next === pi)
                const inDuel = inContested || isChallenger
                // Core stages: challengerDown = champs up / challenger down; result = all up.
                const faceUp = Boolean(step) && Boolean(state.revealed[pi])
                const showBadges = Boolean(burst) && inDuel && state.resolveSubphase === 'result'
                const result =
                  showBadges && step
                    ? duelResultForSeat(step, pi)
                    : { kind: 'idle' as const, label: '' }
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
        {handOver && roundDwelling ? (
          <div className="rsb-countdown rsb-countdown-dwell" aria-live="polite">
            Round complete
          </div>
        ) : null}
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
