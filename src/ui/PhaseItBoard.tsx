import { useEffect, useMemo, useRef, useState } from 'react'
import { pumpPhaseItBots } from '../ai/phaseitBot'
import { cardLabel, colorLabel, isSkip, sortPhaseItHand } from '../core/phaseit/deck'
import { canHitMeld, findPhaseGroups, matchPhaseGroups } from '../core/phaseit/melds'
import { CLASSIC_PHASES, phaseDef, phaseLabel, phasesToWin } from '../core/phaseit/phases'
import { applyPhaseItMove } from '../core/phaseit/rules'
import { createPhaseItMatch, dealNextPhaseItRound, topDiscard } from '../core/phaseit/state'
import type { PhaseItCard, PhaseItColor, PhaseItMove, PhaseItState, PhaseItVariant } from '../core/phaseit/types'
import { isMastersVariant, phaseItTip, phaseItVariantLabel } from '../core/phaseit/variants'

export type PhaseItBoardController = {
  state: PhaseItState
  localIndex: number
  aiThinking?: boolean
  submit: (move: PhaseItMove) => { ok: true } | { ok: false; error: string }
  nextHand: () => void
  newMatch?: () => void
  onChange?: (cb: () => void) => () => void
}

type Props = {
  yourName: string
  variant: PhaseItVariant
  playerCount?: number
  onExit: () => void
  controller?: PhaseItBoardController | null
}

const COLOR_CSS: Record<PhaseItColor, string> = {
  R: '#b33a2b',
  Y: '#c9a227',
  G: '#2a7a4b',
  B: '#2a5f8f',
}

function PhaseItCardFace({
  card,
  size = 'md',
  dimmed,
  legal,
  onClick,
}: {
  card: PhaseItCard
  size?: 'md' | 'lg'
  dimmed?: boolean
  legal?: boolean
  onClick?: () => void
}) {
  const bg =
    card.kind === 'wild' || card.kind === 'skip'
      ? '#3d2a4a'
      : card.color
        ? COLOR_CSS[card.color]
        : '#1e2a33'
  const label = cardLabel(card)
  const long = label.length > 3
  const cls = `ichi-face is-${size}${dimmed ? ' is-dim' : ''}${legal ? ' is-legal' : ''}${onClick ? ' is-clickable' : ''}${long ? ' is-long-label' : ''}`
  const aria = `${label}${card.color ? ` ${colorLabel(card.color)}` : card.kind === 'wild' ? ' wild' : ''}`
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

export function PhaseItBoard({ yourName, variant, playerCount = 4, onExit, controller }: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<PhaseItState | null>(null)
  const [err, setErr] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [groups, setGroups] = useState<string[][]>([])
  const [mode, setMode] = useState<'play' | 'lay' | 'hit' | 'discard'>('play')
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
    let cur = createPhaseItMatch(names, computers, variant)
    setFallback(cur)
    fallbackRef.current = cur
    void (async () => {
      setAiThinking(true)
      cur = await pumpPhaseItBots(cur, {
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
  const top = state ? topDiscard(state) : null

  const winN = state ? phasesToWin(state.config.variant) : 10
  const needsChoice =
    Boolean(you && state && isMastersVariant(state.config.variant) && you.phase < 0 && you.remaining.length)
  const def = you && you.phase >= 0 && you.phase < winN ? phaseDef(you.phase) : null
  const suggest = useMemo(() => {
    if (!you || !def || you.phaseDown) return null
    return findPhaseGroups(you.hand, def.parts)
  }, [you, def, tick])

  const play = (move: PhaseItMove) => {
    setErr('')
    setSelected([])
    setGroups([])
    setMode('play')
    if (controller) {
      const res = controller.submit(move)
      if (!res.ok) setErr(res.error)
      return
    }
    const cur = fallbackRef.current
    if (!cur) return
    const res = applyPhaseItMove(cur, move)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setFallback(res.state)
    fallbackRef.current = res.state
    const gen = ++pumpGen.current
    void pumpPhaseItBots(res.state, {
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
      <div className="shell-game phaseit-board">
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
      : state.lastMessage || phaseItTip(state.config.variant)
  const ranked = [...state.players].sort((a, b) => {
    const doneA = winN - a.remaining.length
    const doneB = winN - b.remaining.length
    if (doneB !== doneA) return doneB - doneA
    return a.score - b.score
  })
  const leaderId = ranked[0]?.id
  const handScoreById = new Map((state.lastHandScores ?? []).map((l) => [l.playerId, l]))
  const orderedHand = sortPhaseItHand(you.hand)
  const progressLabel = (p: (typeof state.players)[0]) => {
    const done = winN - p.remaining.length
    if (p.remaining.length === 0) return `Done ${done}/${winN}`
    if (p.phase < 0) return `Pick · ${done}/${winN}`
    return `${phaseLabel(p.phase).replace('Phase ', 'Ph ')}${p.phaseDown ? ' ✓' : ''} · ${done}/${winN}`
  }

  const toggleSelect = (id: string) => {
    if (!yourTurn || !state.hasDrawn) return
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const lockGroup = () => {
    if (!selected.length || !def) return
    if (groups.length >= def.parts.length) {
      setErr(`Need ${def.parts.length} groups for this phase`)
      return
    }
    setGroups((g) => [...g, selected])
    setSelected([])
  }

  const tryLay = () => {
    if (!def) return
    const all = groups.length === def.parts.length ? groups : [...groups, selected].filter((g) => g.length)
    const cardGroups = all.map((ids) =>
      ids.map((id) => you.hand.find((c) => c.id === id)).filter(Boolean),
    ) as PhaseItCard[][]
    if (cardGroups.some((g, i) => g.length !== all[i]!.length)) {
      setErr('Cards not in hand')
      return
    }
    if (!matchPhaseGroups(cardGroups, def.parts)) {
      setErr(`Does not complete ${def.label}`)
      return
    }
    play({ t: 'layPhase', groups: all })
  }

  const hitTargets = useMemo(() => {
    if (!yourTurn || !state.hasDrawn || !you.phaseDown || selected.length !== 1) return []
    const card = you.hand.find((c) => c.id === selected[0])
    if (!card || isSkip(card)) return []
    const out: { target: number; meldIndex: number }[] = []
    state.players.forEach((pl, ti) => {
      if (!pl.phaseDown) return
      pl.laid.forEach((m, mi) => {
        if (canHitMeld(m, card)) out.push({ target: ti, meldIndex: mi })
      })
    })
    return out
  }, [yourTurn, state, you, selected, tick])

  return (
    <div className={`shell-game phaseit-board rummy-board${yourTurn ? ' is-your-turn' : ''}`}>
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
        <div>
          <h2>
            {phaseItVariantLabel(state.config.variant)} · {state.players.length} players
          </h2>
          <p className="muted">
            Hand {state.round} · first through Phase {winN} wins
          </p>
          <p className="rummy-tip">{phaseItTip(state.config.variant)}</p>
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
              ? needsChoice
                ? 'Your turn — choose which phase to attempt'
                : !state.hasDrawn
                  ? 'Your turn — draw from stock or discard'
                  : you.phaseDown
                    ? mode === 'discard'
                      ? 'Discard one card to end your turn'
                      : 'Hit on melds, then discard'
                    : `Complete ${phaseLabel(you.phase)}`
              : `${actingName}'s turn`}
        </strong>
        <span>{status}</span>
      </div>

      {needsChoice && yourTurn ? (
        <div className="phaseit-choose-panel" aria-label="Choose phase">
          <p className="muted">Pick one remaining phase for this hand:</p>
          <div className="phaseit-choose-grid">
            {you.remaining.map((idx) => {
              const d = CLASSIC_PHASES[idx]!
              return (
                <button
                  key={idx}
                  type="button"
                  className="btn secondary"
                  onClick={() => play({ t: 'choosePhase', phaseIndex: idx })}
                >
                  Phase {idx + 1}: {d.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {err ? <p className="error">{err}</p> : null}

      <div className="rummy-scoreboard" aria-label="Match scores">
        {state.players.map((p, pi) => {
          const line = handScoreById.get(p.id)
          const isLeader = p.id === leaderId
          const isWinner = matchOver && p.id === state.winnerId
          const isTheirTurn = !roundOver && !matchOver && state.current === pi
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
              <span className="rummy-score-delta">
                {roundOver || matchOver
                  ? line
                    ? `${line.delta > 0 ? '+' : ''}${line.delta} · ${winN - (state.players.find((x) => x.id === p.id)?.remaining.length ?? 0)}/${winN}`
                    : '—'
                  : `${progressLabel(p)} · ${p.hand.length} cards`}
              </span>
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
                else setFallback(dealNextPhaseItRound(state))
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

      <div className="trick-current" aria-label="Piles">
        <div className="rummy-piles">
          <div className="rummy-pile">
            <span className="pile-label">Stock ({state.stock.length})</span>
            <button
              type="button"
              className={`ichi-face is-lg is-back${yourTurn && !needsChoice && !state.hasDrawn ? ' is-legal is-clickable' : ''}`}
              disabled={!yourTurn || needsChoice || state.hasDrawn}
              onClick={() => play({ t: 'drawStock' })}
              aria-label="Draw from stock"
            >
              Draw
            </button>
          </div>
          <div className="rummy-pile">
            <span className="pile-label">Discard</span>
            {top ? (
              <PhaseItCardFace
                card={top}
                size="lg"
                legal={yourTurn && !needsChoice && !state.hasDrawn && !isSkip(top)}
                onClick={
                  yourTurn && !needsChoice && !state.hasDrawn && !isSkip(top)
                    ? () => play({ t: 'drawDiscard' })
                    : undefined
                }
              />
            ) : (
              <div className="ichi-face is-lg is-empty">—</div>
            )}
          </div>
        </div>
      </div>

      <div className="phaseit-melds" aria-label="Laid phases">
        {state.players.map((p, pi) =>
          p.phaseDown && p.laid.length ? (
            <div key={p.id} className="phaseit-meld-row">
              <span className="pile-label">
                {p.name}
                {pi === localIndex ? ' (you)' : ''} · {phaseLabel(p.phase)}
              </span>
              <div className="rummy-card-row">
                {p.laid.map((m, mi) => {
                  const canHitHere =
                    mode === 'hit' &&
                    hitTargets.some((t) => t.target === pi && t.meldIndex === mi)
                  return (
                    <div key={mi} className="phaseit-meld-group">
                      <span className="muted tiny">{m.kind}</span>
                      <div className="rummy-card-row">
                        {m.cards.map((c) => (
                          <PhaseItCardFace
                            key={c.id}
                            card={c}
                            size="md"
                            legal={canHitHere}
                            onClick={
                              canHitHere && selected[0]
                                ? () =>
                                    play({
                                      t: 'hit',
                                      cardId: selected[0]!,
                                      target: pi,
                                      meldIndex: mi,
                                    })
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null,
        )}
      </div>

      {!you.phaseDown && yourTurn && state.hasDrawn && def ? (
        <div className="phaseit-lay-panel">
          <p className="muted">
            Select cards for each part of <strong>{def.label}</strong>
            {groups.length ? ` · locked ${groups.length}/${def.parts.length}` : ''}
          </p>
          {groups.map((g, i) => (
            <div key={i} className="rummy-card-row">
              <span className="muted tiny">Group {i + 1}</span>
              {g.map((id) => {
                const card = you.hand.find((c) => c.id === id)
                return card ? <PhaseItCardFace key={id} card={card} size="md" dimmed /> : null
              })}
              <button
                type="button"
                className="btn ghost"
                onClick={() => setGroups((prev) => prev.filter((_, j) => j !== i))}
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className={`rummy-hand${yourTurn ? ' is-active' : ''}`} aria-label="Your hand">
        {orderedHand.map((c) => {
          const inGroup = groups.some((g) => g.includes(c.id))
          const sel = selected.includes(c.id)
          const interactive =
            yourTurn &&
            state.hasDrawn &&
            !inGroup &&
            (mode === 'lay' || mode === 'hit' || mode === 'discard' || !you.phaseDown)
          return (
            <button
              key={c.id}
              type="button"
              className={`rummy-hand-slot ichi-hand-slot${sel ? ' is-selected' : ''}${interactive ? ' is-legal-slot' : ''}`}
              disabled={!interactive}
              onClick={() => {
                if (mode === 'discard') {
                  play({ t: 'discard', cardId: c.id })
                  return
                }
                if (mode === 'hit') {
                  setSelected([c.id])
                  return
                }
                toggleSelect(c.id)
              }}
            >
              <PhaseItCardFace card={c} size="md" legal={sel} dimmed={inGroup} />
            </button>
          )
        })}
      </div>

      <div className="rummy-actions">
        {!roundOver && !matchOver && yourTurn && state.hasDrawn ? (
          <>
            {!you.phaseDown && def ? (
              <>
                <button type="button" className="btn secondary" disabled={!selected.length} onClick={lockGroup}>
                  Lock group
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={tryLay}
                  disabled={groups.length + (selected.length ? 1 : 0) < def.parts.length && groups.length < def.parts.length}
                >
                  Lay phase
                </button>
                {suggest ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setGroups(suggest)
                      setSelected([])
                      setMode('lay')
                    }}
                  >
                    Suggest
                  </button>
                ) : null}
              </>
            ) : null}
            {you.phaseDown ? (
              <>
                <button
                  type="button"
                  className={`btn ${mode === 'hit' ? 'primary' : 'secondary'}`}
                  onClick={() => {
                    setMode((m) => (m === 'hit' ? 'play' : 'hit'))
                    setSelected([])
                  }}
                >
                  {mode === 'hit' ? 'Cancel hit' : 'Hit'}
                </button>
                <button
                  type="button"
                  className={`btn ${mode === 'discard' ? 'primary' : 'secondary'}`}
                  onClick={() => {
                    setMode((m) => (m === 'discard' ? 'play' : 'discard'))
                    setSelected([])
                  }}
                >
                  {mode === 'discard' ? 'Cancel discard' : 'Discard'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`btn ${mode === 'discard' ? 'primary' : 'ghost'}`}
                onClick={() => {
                  setMode((m) => (m === 'discard' ? 'play' : 'discard'))
                  setSelected([])
                }}
              >
                {mode === 'discard' ? 'Cancel discard' : 'Discard without laying'}
              </button>
            )}
          </>
        ) : null}
      </div>
      <p className="muted tiny rummy-hand-hint">
        Draw, complete your phase (sets / runs / color), hit on any down melds, then discard. Skip skips the next player.
      </p>
    </div>
  )
}
