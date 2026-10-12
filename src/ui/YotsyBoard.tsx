import { useEffect, useMemo, useRef, useState } from 'react'
import { pumpYotsyBots } from '../ai/yotsyBot'
import {
  hasFiveKindBonus,
  hasUpperBonus,
  lowerCategories,
  turnsNeeded,
  UPPER_CATEGORIES,
  categoryLabel,
} from '../core/yotsy/categories'
import { dieColor } from '../core/yotsy/dice'
import { applyYotsyMove } from '../core/yotsy/rules'
import {
  lowerSubtotal,
  openCategories,
  playerTotal,
  scoreWithJoker,
  upperBonus,
  upperSubtotal,
} from '../core/yotsy/score'
import { createYotsyMatch } from '../core/yotsy/state'
import type { YotsyCategory, YotsyDie, YotsyMove, YotsyState, YotsyVariant } from '../core/yotsy/types'
import { yotsyTip, yotsyVariantLabel } from '../core/yotsy/variants'

export type YotsyBoardController = {
  state: YotsyState
  localIndex: number
  aiThinking?: boolean
  submit: (move: YotsyMove) => { ok: true } | { ok: false; error: string }
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
}

type Props = {
  yourName: string
  variant: YotsyVariant
  playerCount?: number
  onExit: () => void
  controller?: YotsyBoardController | null
}

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function DieFace({
  die,
  rolling,
  interactive,
  colored,
  onClick,
}: {
  die: YotsyDie
  rolling?: boolean
  interactive?: boolean
  colored?: boolean
  onClick?: () => void
}) {
  const pips = PIP_MAP[die.value] ?? [4]
  const color = colored ? dieColor(die.value) : null
  const cls = [
    'yotsy-die',
    die.held ? 'is-held' : '',
    rolling && !die.held ? 'is-rolling' : '',
    interactive ? 'is-clickable' : '',
    color ? `is-${color}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const body = (
    <span className="yotsy-die-face" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <span
          key={i}
          className={`yotsy-pip${pips.includes(i) ? ' is-on' : ''}${color ? ` is-${color}` : ''}`}
        />
      ))}
    </span>
  )
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        aria-label={`Die ${die.value}${color ? `, ${color}` : ''}${die.held ? ', held' : ''}`}
        disabled={!interactive}
      >
        {body}
      </button>
    )
  }
  return (
    <div className={cls} aria-label={`Die ${die.value}${color ? `, ${color}` : ''}`}>
      {body}
    </div>
  )
}

export function YotsyBoard({ yourName, variant, playerCount = 2, onExit, controller }: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<YotsyState | null>(null)
  const [err, setErr] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [rolling, setRolling] = useState(false)
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
    let cur = createYotsyMatch(names, computers, variant)
    setFallback(cur)
    fallbackRef.current = cur
    void (async () => {
      setAiThinking(true)
      cur = await pumpYotsyBots(cur, {
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
  const matchOver = state?.phase === 'matchEnd'
  const yourTurn = state != null && state.current === localIndex && state.phase === 'play'
  const actingName = state?.players[state.current]?.name ?? 'Someone'
  const gameVariant = state?.config.variant ?? variant
  const boxes = turnsNeeded(gameVariant)
  const colored = gameVariant === 'kismet'
  const lower = lowerCategories(gameVariant)

  const play = (move: YotsyMove) => {
    setErr('')
    const doSubmit = () => {
      if (controller) {
        const res = controller.submit(move)
        if (!res.ok) setErr(res.error)
        return
      }
      const cur = fallbackRef.current
      if (!cur) return
      const res = applyYotsyMove(cur, move)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setFallback(res.state)
      fallbackRef.current = res.state
      const gen = ++pumpGen.current
      void pumpYotsyBots(res.state, {
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

    if (move.t === 'roll') {
      setRolling(true)
      window.setTimeout(() => {
        setRolling(false)
        doSubmit()
      }, 650)
      return
    }
    doSubmit()
  }

  const previews = useMemo(() => {
    if (!state || !you || !yourTurn || !state.hasRolled) return null
    const vals = state.dice.map((d) => d.value)
    const served = state.rollsLeft === 2
    const map = new Map<YotsyCategory, number>()
    for (const c of openCategories(you.card, gameVariant)) {
      map.set(c, scoreWithJoker(vals, c, you.card, gameVariant, { served }))
    }
    return map
  }, [state, you, yourTurn, tick, gameVariant])

  if (!state || !you) {
    return (
      <div className="shell-game yotsy-board">
        <p className="muted">Shaking the cup…</p>
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
      </div>
    )
  }

  const status =
    thinking && !yourTurn
      ? `${actingName} is thinking…`
      : state.lastMessage || yotsyTip(gameVariant)
  const ranked = [...state.players].sort(
    (a, b) => playerTotal(b, gameVariant) - playerTotal(a, gameVariant),
  )
  const leaderId = ranked[0]?.id
  const showUpperBonus = hasUpperBonus(gameVariant)
  const showFiveBonus = hasFiveKindBonus(gameVariant)
  const bonusLabel =
    gameVariant === 'kismet' ? 'Bonus (63/71/78)' : 'Bonus (63+)'
  const fiveBonusLabel = gameVariant === 'kismet' ? 'Kismet bonus' : 'Yotsy bonus'

  const renderCardCol = (cats: YotsyCategory[], title: string) => (
    <div className="yotsy-card-col">
      <h3>{title}</h3>
      {cats.map((c) => {
        const filled = you.card[c]
        const open = filled == null
        const preview = previews?.get(c)
        const canScore = yourTurn && state.hasRolled && open && !rolling
        return (
          <button
            key={c}
            type="button"
            className={`yotsy-box${open ? '' : ' is-filled'}${canScore ? ' is-open' : ''}`}
            disabled={!canScore}
            onClick={() => play({ t: 'score', category: c })}
          >
            <span>{categoryLabel(c, gameVariant)}</span>
            <strong>
              {filled != null ? filled : preview != null && yourTurn ? preview : '—'}
            </strong>
          </button>
        )
      })}
      {title === 'Upper' ? (
        <>
          <div className="yotsy-box is-meta">
            <span>Subtotal</span>
            <strong>{upperSubtotal(you.card)}</strong>
          </div>
          {showUpperBonus ? (
            <div className="yotsy-box is-meta">
              <span>{bonusLabel}</span>
              <strong>{upperBonus(you.card, gameVariant)}</strong>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="yotsy-box is-meta">
            <span>Lower</span>
            <strong>{lowerSubtotal(you.card, gameVariant)}</strong>
          </div>
          {showFiveBonus ? (
            <div className="yotsy-box is-meta">
              <span>{fiveBonusLabel}</span>
              <strong>{you.yahtzeeBonuses}</strong>
            </div>
          ) : null}
          <div className="yotsy-box is-meta is-total">
            <span>Total</span>
            <strong>{playerTotal(you, gameVariant)}</strong>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className={`shell-game yotsy-board rummy-board${yourTurn ? ' is-your-turn' : ''}`}>
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
        <div>
          <h2>
            {yotsyVariantLabel(gameVariant)} · {state.players.length} players
          </h2>
          <p className="muted">
            Turn {Math.min(boxes, you.turnsDone + (yourTurn ? 1 : 0))} of {boxes}
          </p>
          <p className="rummy-tip">{yotsyTip(gameVariant)}</p>
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
              ? !state.hasRolled
                ? 'Your turn — roll the dice'
                : state.rollsLeft > 0
                  ? `Hold keepers, roll again (${state.rollsLeft} left), or score`
                  : 'Score a box — no rolls left'
              : `${actingName}'s turn`}
        </strong>
        <span>{status}</span>
      </div>

      {err ? <p className="error">{err}</p> : null}

      <div className="rummy-scoreboard" aria-label="Match scores">
        {state.players.map((p, pi) => {
          const isLeader = p.id === leaderId
          const isWinner = matchOver && p.id === state.winnerId
          const isTheirTurn = !matchOver && state.current === pi
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
              <span className="rummy-score-total">{playerTotal(p, gameVariant)}</span>
              <span className="rummy-score-delta">
                {p.turnsDone}/{boxes} boxes
                {isTheirTurn ? (pi === localIndex ? ' · YOUR TURN' : ' · THEIR TURN') : ''}
              </span>
            </div>
          )
        })}
      </div>

      {matchOver ? (
        <div className="rummy-hand-end">
          <p className="rummy-hand-end-note">
            {state.players.find((p) => p.id === state.winnerId)?.name ?? 'Someone'} wins with{' '}
            {playerTotal(state.players.find((p) => p.id === state.winnerId)!, gameVariant)} points.
          </p>
          {controller?.newMatch ? (
            <button type="button" className="btn primary" onClick={() => controller.newMatch?.()}>
              New match
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="yotsy-dice-tray" aria-label="Dice">
        <div className="yotsy-dice-row">
          {state.dice.map((d) => (
            <DieFace
              key={d.id}
              die={d}
              rolling={rolling}
              colored={colored}
              interactive={yourTurn && state.hasRolled && state.rollsLeft > 0 && !rolling}
              onClick={
                yourTurn && state.hasRolled && state.rollsLeft > 0 && !rolling
                  ? () => play({ t: 'toggleHold', dieId: d.id })
                  : undefined
              }
            />
          ))}
        </div>
        <div className="rummy-actions">
          {yourTurn && !matchOver ? (
            <button
              type="button"
              className="btn primary yotsy-roll-btn"
              disabled={state.rollsLeft <= 0 || rolling}
              onClick={() => play({ t: 'roll' })}
            >
              {rolling ? 'Rolling…' : state.hasRolled ? `Roll again (${state.rollsLeft})` : 'Roll'}
            </button>
          ) : null}
        </div>
        <p className="muted tiny rummy-hand-hint">
          {colored
            ? '1/6 black · 2/5 red · 3/4 green. Tap to hold, roll up to three times, then score.'
            : 'Tap a die to hold it (gold rim). Roll up to three times, then tap a score box.'}
        </p>
      </div>

      <div className="yotsy-scorecard" aria-label="Your scorecard">
        {renderCardCol(UPPER_CATEGORIES, 'Upper')}
        {renderCardCol(lower, 'Lower')}
      </div>
    </div>
  )
}
