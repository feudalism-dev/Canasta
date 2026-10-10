import { useEffect, useMemo, useState } from 'react'
import { pumpIchiBots } from '../ai/ichiBot'
import { colorLabel, kindLabel, ICHI_COLORS } from '../core/ichi/deck'
import { applyIchiMove, legalPlays } from '../core/ichi/rules'
import { createIchiMatch, topCard } from '../core/ichi/state'
import type { IchiColor, IchiMove, IchiState, IchiVariant } from '../core/ichi/types'
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
  R: '#c0392b',
  Y: '#d4a017',
  G: '#1e8449',
  B: '#2471a3',
}

function IchiCardFace({
  color,
  kind,
  selected,
  dimmed,
  onClick,
}: {
  color: IchiColor | null
  kind: string
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
}) {
  const bg = color ? COLOR_CSS[color] : '#2c3e50'
  return (
    <button
      type="button"
      className={`ichi-card${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
      style={{ background: bg }}
      onClick={onClick}
      disabled={!onClick}
    >
      <span>{kindLabel(kind as never)}</span>
    </button>
  )
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
      <div className="shell-menu">
        <p className="muted">Dealing Ichi…</p>
      </div>
    )
  }

  const top = topCard(state)
  const status =
    thinking && !yourTurn
      ? `${state.players[actor ?? 0]?.name || 'Computer'} is thinking…`
      : state.lastMessage || ''

  return (
    <div className="ichi-board">
      <style>{`
        .ichi-board { display:flex; flex-direction:column; gap:0.75rem; padding:0.75rem; max-width:920px; margin:0 auto; }
        .ichi-row { display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; }
        .ichi-card {
          min-width:3.2rem; height:4.4rem; border-radius:0.45rem; border:2px solid rgba(255,255,255,0.35);
          color:#fff; font-weight:700; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; justify-content:center;
        }
        .ichi-card.selected { outline:2px solid #f5d76e; }
        .ichi-card.dimmed { opacity:0.4; cursor:default; }
        .ichi-card:disabled { cursor:default; }
        .ichi-pile { min-width:3.6rem; height:4.8rem; }
        .ichi-meta { display:flex; flex-wrap:wrap; gap:0.75rem; font-size:0.9rem; }
        .ichi-color-chip { width:1rem; height:1rem; border-radius:2px; display:inline-block; vertical-align:middle; margin-right:0.25rem; }
      `}</style>

      <div className="ichi-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{ichiVariantLabel(variant)}</strong>
          <span className="muted"> · hand {state.round} · to {state.config.playTo ?? '—'}</span>
        </div>
        <button type="button" className="btn ghost" onClick={onExit}>
          Menu
        </button>
      </div>

      <div className="ichi-meta">
        {state.players.map((p, i) => (
          <div key={p.id}>
            <em>{p.name}</em> {p.hand.length} cards · {p.score}
            {i === state.current && state.phase === 'play' ? ' · turn' : ''}
            {state.ichiCalled[i] && p.hand.length === 1 ? ' · Ichi!' : ''}
          </div>
        ))}
      </div>

      <p>
        <span
          className="ichi-color-chip"
          style={{ background: COLOR_CSS[state.currentColor] }}
        />
        Color <strong>{colorLabel(state.currentColor)}</strong>
        {state.direction === 1 ? ' · clockwise' : ' · counter-clockwise'}
        {top ? ` · discard ${kindLabel(top.kind)}${top.color ? ` ${colorLabel(top.color)}` : ''}` : ''}
      </p>

      <div className="ichi-row">
        <div className="ichi-card ichi-pile" style={{ background: '#1a252f' }} aria-label="Stock">
          <span>Draw ({state.stock.length})</span>
        </div>
        {top ? (
          <IchiCardFace color={top.color} kind={top.kind} />
        ) : (
          <div className="ichi-card ichi-pile dimmed">—</div>
        )}
      </div>

      <p className="muted">{status}</p>
      {err ? <p className="error">{err}</p> : null}

      <div className="ichi-row">
        {you.hand.map((c) => {
          const can = yourTurn && state.phase === 'play' && legalIds.has(c.id)
          return (
            <IchiCardFace
              key={c.id}
              color={c.color}
              kind={c.kind}
              dimmed={yourTurn && state.phase === 'play' && !can}
              onClick={can ? () => play({ t: 'play', cardId: c.id }) : undefined}
            />
          )
        })}
      </div>

      <div className="ichi-row">
        {!roundOver && !matchOver && state.phase === 'play' && yourTurn ? (
          <>
            <button
              type="button"
              className="btn secondary"
              disabled={legal.length > 0 && !state.drawnPlayableId}
              onClick={() => play(state.drawnPlayableId ? { t: 'pass' } : { t: 'draw' })}
            >
              {state.drawnPlayableId ? 'Keep drawn / Pass' : 'Draw'}
            </button>
            {(you.hand.length === 1 || state.ichiPending === localIndex) && !state.ichiCalled[localIndex] ? (
              <button type="button" className="btn primary" onClick={() => play({ t: 'callIchi' })}>
                Call Ichi!
              </button>
            ) : null}
          </>
        ) : null}

        {!roundOver && !matchOver && state.phase === 'colorPick' && yourTurn ? (
          <>
            {ICHI_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="btn primary"
                style={{ background: COLOR_CSS[c] }}
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
              Draw 4
            </button>
            <button type="button" className="btn primary" onClick={() => play({ t: 'challenge' })}>
              Challenge
            </button>
          </>
        ) : null}

        {roundOver ? (
          <button type="button" className="btn primary" onClick={() => controller?.nextHand()}>
            Next hand
          </button>
        ) : null}
        {matchOver ? (
          <button
            type="button"
            className="btn primary"
            onClick={() => (controller?.newMatch ? controller.newMatch() : onExit())}
          >
            New match
          </button>
        ) : null}
      </div>

      <p className="muted tiny">{state.log.slice(-3).join(' · ')}</p>
    </div>
  )
}
