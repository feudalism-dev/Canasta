import { useEffect, useMemo, useState } from 'react'
import type { TrickMove, TrickState, TrickVariant } from '../core/trick/types'
import { createTrickMatch, dealNextTrickRound } from '../core/trick/state'
import { applyTrickMove, legalPlays } from '../core/trick/rules'
import { passDirectionLabel } from '../core/trick/variants'
import { pumpTrickBots } from '../ai/trickBot'
import { CardView } from './CardView'

export type TrickBoardController = {
  state: TrickState
  localIndex: number
  aiThinking?: boolean
  submit: (move: TrickMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
}

type Props = {
  yourName: string
  variant: TrickVariant
  onExit: () => void
  controller?: TrickBoardController | null
}

export function TrickBoard({ yourName, variant, onExit, controller }: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<TrickState | null>(null)
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
    if (variant !== 'hearts') return
    const names = [yourName || 'You', 'Computer 1', 'Computer 2', 'Computer 3']
    const computers = [false, true, true, true]
    let cancelled = false
    let cur = createTrickMatch(names, computers, variant)
    setFallback(cur)
    void (async () => {
      setAiThinking(true)
      cur = await pumpTrickBots(cur, {
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
  }, [controller, yourName, variant])

  void tick
  const state = controller?.state ?? fallback
  const localIndex = controller?.localIndex ?? 0
  const thinking = controller?.aiThinking ?? aiThinking
  const you = state?.players[localIndex]
  const yourTurn = Boolean(
    state &&
      you &&
      state.current === localIndex &&
      state.phase !== 'roundEnd' &&
      state.phase !== 'matchEnd',
  )
  const roundOver = state?.phase === 'roundEnd'
  const matchOver = state?.phase === 'matchEnd'
  const legal =
    state && you && yourTurn && state.phase === 'play'
      ? new Set(legalPlays(state, localIndex).map((c) => c.id))
      : new Set<string>()

  const actingName = state?.players[state.current]?.name ?? 'Someone'
  const status = useMemo(() => {
    if (!state || !you) return 'Dealing…'
    if (matchOver) {
      const w = state.players.find((p) => p.id === state.winnerId)
      return `Match over — ${w?.name ?? 'lowest score'} wins`
    }
    if (roundOver) {
      return state.lastHandNote
        ? `${state.lastHandNote} Deal next hand when ready.`
        : 'Hand over — Deal next hand when ready.'
    }
    if (thinking) return 'Waiting for computers…'
    if (state.phase === 'pass') {
      return `Select 3 cards to pass ${passDirectionLabel(state.passDirection)}`
    }
    if (state.lastTrickNote && state.trick.length === 0) {
      if (yourTurn) {
        return `${state.lastTrickNote}. Your lead.`
      }
      return `${state.lastTrickNote}. ${actingName} leads.`
    }
    if (!yourTurn) return `Wait — ${actingName} is playing`
    if (state.trick.length === 0) {
      return state.heartsBroken
        ? 'Your lead — play any card'
        : 'Your lead — hearts locked until broken (unless only hearts)'
    }
    return 'Follow suit if you can'
  }, [state, you, yourTurn, roundOver, matchOver, thinking, actingName])

  const play = (move: TrickMove) => {
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
    const res = applyTrickMove(state, move)
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
      next = await pumpTrickBots(next, {
        isCancelled: () => false,
        onThinking: setAiThinking,
        onStep: (s) => setFallback(s),
      })
      setFallback(next)
      setAiThinking(false)
    })()
  }

  const toggle = (id: string) => {
    if (!state || !yourTurn) return
    if (state.phase === 'pass') {
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id)
        if (prev.length >= 3) return prev
        return [...prev, id]
      })
      return
    }
    if (state.phase === 'play') {
      if (!legal.has(id)) {
        setErr('That card is not a legal play')
        return
      }
      play({ t: 'play', cardId: id })
    }
  }

  if (!state || !you) {
    return (
      <div className="shell-game trick-board">
        <p className="muted">
          {variant === 'hearts' ? 'Dealing…' : 'This game is coming soon — pick Hearts for now.'}
        </p>
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
      </div>
    )
  }

  const ranked = [...state.players].sort((a, b) => a.score - b.score)
  const leaderId = ranked[0]?.id
  const handScoreById = new Map((state.lastHandScores ?? []).map((l) => [l.playerId, l]))

  return (
    <div className={`shell-game trick-board${yourTurn ? ' is-your-turn' : ''}`}>
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
        <div>
          <h2>Hearts · {state.players.length} players</h2>
          <p className="muted">
            Hand {state.round} · pass {passDirectionLabel(state.passDirection)}
            {state.heartsBroken ? ' · hearts broken' : ' · hearts locked'} · first to 100 (lowest wins)
          </p>
          <p className="rummy-tip">
            Pass three, then follow suit. Hearts = 1, Q♠ = 13. Take all 26 to shoot the moon.
          </p>
        </div>
      </header>

      <div
        className={`rummy-turn-banner is-${yourTurn ? 'you' : thinking ? 'wait' : 'other'}`}
        role="status"
      >
        <strong>
          {thinking ? 'Computers are thinking…' : yourTurn ? 'Your turn' : `${actingName}'s turn`}
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
          const tricks = state.tricksTaken[pi] ?? 0
          const handPts = p.takenThisHand
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
                  {line ? `+${line.delta} this hand` : '—'}
                </span>
              ) : (
                <>
                  <span className="rummy-score-delta">
                    {tricks} trick{tricks === 1 ? '' : 's'} · {handPts} pts
                    {isTheirTurn ? (pi === localIndex ? ' · YOUR TURN' : ' · THEIR TURN') : ''}
                  </span>
                </>
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
                  else setFallback(dealNextTrickRound(state))
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
                    createTrickMatch(
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

      <div className="trick-current" aria-label="Current trick">
        <span className="pile-label">
          Trick · {state.trick.length}/{state.players.length}
          {state.phase === 'play'
            ? ` · you have ${state.tricksTaken[localIndex] ?? 0} this hand`
            : ''}
        </span>
        {state.lastTrickNote && state.trick.length === 0 && !roundOver && !matchOver ? (
          <p className="trick-taken-banner" role="status">
            {state.lastTrickNote}
          </p>
        ) : null}
        <div className="rummy-card-row">
          {state.trick.length === 0 ? (
            <div className="pile-empty">
              {state.lastTrickNote ? 'Next lead…' : 'Waiting for lead'}
            </div>
          ) : (
            state.trick.map((t) => (
              <div key={t.card.id} className="trick-play">
                <span className="muted tiny">
                  {state.players.find((p) => p.seat === t.seat)?.name ?? `P${t.seat + 1}`}
                </span>
                <CardView card={t.card} size="lg" />
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`rummy-hand${yourTurn ? ' is-active' : ''}`}>
        {you.hand.map((c) => {
          const dim =
            state.phase === 'play' && yourTurn && !legal.has(c.id) ? ' is-illegal' : ''
          return (
            <button
              key={c.id}
              type="button"
              className={`rummy-hand-slot${selected.includes(c.id) ? ' is-selected' : ''}${dim}`}
              disabled={!yourTurn || (state.phase === 'play' && !legal.has(c.id))}
              onClick={() => toggle(c.id)}
            >
              <CardView card={c} size="md" selected={selected.includes(c.id)} />
            </button>
          )
        })}
      </div>

      {!roundOver && !matchOver && state.phase === 'pass' ? (
        <div className="rummy-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!yourTurn || selected.length !== 3}
            onClick={() => play({ t: 'pass', cardIds: selected })}
          >
            Pass 3 {passDirectionLabel(state.passDirection)}
          </button>
        </div>
      ) : null}

      <p className="muted tiny">{state.log.slice(-3).join(' · ')}</p>
    </div>
  )
}
