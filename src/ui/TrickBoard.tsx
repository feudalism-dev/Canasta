import { useEffect, useMemo, useRef, useState } from 'react'
import type { Suit } from '../core/cards'
import { SUITS } from '../core/cards'
import type { TrickMove, TrickState, TrickVariant } from '../core/trick/types'
import { createTrickMatch, dealNextTrickRound } from '../core/trick/state'
import { applyTrickMove, legalPlays } from '../core/trick/rules'
import { passDirectionLabel } from '../core/trick/variants'
import {
  ROOSTER_COLOR,
  ROOSTER_MIN_BID,
  ROOSTER_NEST_SIZE,
  sortRoosterHand,
} from '../core/trick/roosterDeck'
import { suggestedBids, teamOfIndex } from '../core/trick/roosterRules'
import { sortTrickHand } from '../core/trick/deck'
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

function mergeHandOrder(prev: string[], handIds: string[]): string[] {
  const live = new Set(handIds)
  const kept = prev.filter((id) => live.has(id))
  const keptSet = new Set(kept)
  const added = handIds.filter((id) => !keptSet.has(id))
  return [...kept, ...added]
}

export function TrickBoard({ yourName, variant, onExit, controller }: Props) {
  const [tick, setTick] = useState(0)
  const [fallback, setFallback] = useState<TrickState | null>(null)
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
    if (variant !== 'hearts' && variant !== 'rooster') return
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
  const isRooster = state?.config.variant === 'rooster'
  const palette = isRooster ? 'rooster' : 'french'
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

  const handIdsKey = you?.hand.map((c) => c.id).join('|') ?? ''
  useEffect(() => {
    setHandOrder((prev) => mergeHandOrder(prev, handIdsKey ? handIdsKey.split('|') : []))
  }, [handIdsKey])

  const handById = useMemo(() => new Map((you?.hand ?? []).map((c) => [c.id, c])), [handIdsKey, you?.hand])
  const orderedHand = useMemo(
    () => handOrder.map((id) => handById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [handOrder, handById],
  )

  const actingName = state?.players[state.current]?.name ?? 'Someone'
  const status = useMemo(() => {
    if (!state || !you) return 'Dealing…'
    if (matchOver) {
      const w = state.players.find((p) => p.id === state.winnerId)
      return `Match over — ${w?.name ?? 'winners'} win`
    }
    if (roundOver) {
      return state.lastHandNote
        ? `${state.lastHandNote} Deal next hand when ready.`
        : 'Hand over — Deal next hand when ready.'
    }
    if (thinking) return 'Waiting for computers…'
    if (state.phase === 'bid') {
      return yourTurn
        ? `Bid (min ${ROOSTER_MIN_BID}) or pass${state.bidAmount ? ` · high ${state.bidAmount}` : ''}`
        : `${actingName} is bidding${state.bidAmount ? ` · high ${state.bidAmount}` : ''}`
    }
    if (state.phase === 'nest') {
      return yourTurn
        ? `Select ${ROOSTER_NEST_SIZE} cards to bury in the nest`
        : `${actingName} is burying the nest`
    }
    if (state.phase === 'trump') {
      return yourTurn ? 'Name trump color' : `${actingName} is naming trump`
    }
    if (state.phase === 'pass') {
      return `Select 3 cards to pass ${passDirectionLabel(state.passDirection)}`
    }
    if (state.lastTrickNote && state.trick.length === 0) {
      if (yourTurn) return `${state.lastTrickNote}. Your lead.`
      return `${state.lastTrickNote}. ${actingName} leads.`
    }
    if (!yourTurn) return `Wait — ${actingName} is playing`
    if (state.trick.length === 0) {
      if (isRooster) return 'Your lead — any card'
      return state.heartsBroken
        ? 'Your lead — play any card'
        : 'Your lead — hearts locked until broken (unless only hearts)'
    }
    return 'Follow suit if you can'
  }, [state, you, yourTurn, roundOver, matchOver, thinking, actingName, isRooster])

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
    if (dragged.current) {
      dragged.current = false
      return
    }
    if (!state || !yourTurn) return
    if (state.phase === 'pass' || state.phase === 'nest') {
      const max = state.phase === 'nest' ? ROOSTER_NEST_SIZE : 3
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id)
        if (prev.length >= max) return prev
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

  const sortMyHand = () => {
    if (!you || !state) return
    const sorted = isRooster
      ? sortRoosterHand(you.hand, state.trump)
      : sortTrickHand(you.hand)
    setHandOrder(sorted.map((c) => c.id))
  }

  if (!state || !you) {
    return (
      <div className="shell-game trick-board">
        <p className="muted">
          {variant === 'hearts' || variant === 'rooster'
            ? 'Dealing…'
            : 'This game is coming soon — pick Hearts or Rooster for now.'}
        </p>
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
      </div>
    )
  }

  const ascending = state.config.scoreAscending !== false && !isRooster
  const ranked = [...state.players].sort((a, b) => (ascending ? a.score - b.score : b.score - a.score))
  const leaderId = ranked[0]?.id
  const handScoreById = new Map((state.lastHandScores ?? []).map((l) => [l.playerId, l]))
  const bidOptions = isRooster && state.phase === 'bid' ? suggestedBids(state) : []
  const trumpLabel =
    state.trump && state.trump !== 'J'
      ? ROOSTER_COLOR[state.trump as Exclude<Suit, 'J'>]
      : null

  return (
    <div className={`shell-game trick-board${yourTurn ? ' is-your-turn' : ''}`}>
      <header className="rummy-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          Quit to Menu
        </button>
        <div>
          <h2>
            {isRooster ? 'Rooster' : 'Hearts'} · {state.players.length} players
            {isRooster ? ' · partners across' : ''}
          </h2>
          <p className="muted">
            {isRooster ? (
              <>
                Hand {state.round}
                {state.bidAmount ? ` · bid ${state.bidAmount}` : ''}
                {trumpLabel ? ` · trump ${trumpLabel}` : ''}
                {state.phase === 'bid' || state.phase === 'nest' || state.phase === 'trump'
                  ? ` · nest ${state.nest.length || ROOSTER_NEST_SIZE}`
                  : ''}
                {' · first partnership to 300'}
              </>
            ) : (
              <>
                Hand {state.round} · pass {passDirectionLabel(state.passDirection)}
                {state.heartsBroken ? ' · hearts broken' : ' · hearts locked'} · first to 100 (lowest
                wins)
              </>
            )}
          </p>
          <p className="rummy-tip">
            {isRooster
              ? 'Bid for the nest, bury five, name trump. Counters: 5=5, 10/14=10, bird=20. Last trick takes the nest.'
              : 'Pass three, then follow suit. Hearts = 1, Q♠ = 13. Take all 26 to shoot the moon.'}
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
          const partner = isRooster ? (pi % 2 === 0 ? '1+3' : '2+4') : null
          return (
            <div
              key={p.id}
              className={`rummy-score-card${isLeader ? ' is-leader' : ''}${isWinner ? ' is-winner' : ''}${isTheirTurn ? ' is-turn' : ''}`}
            >
              <span className="rummy-score-name">
                {p.name}
                {pi === localIndex ? ' (you)' : ''}
                {partner ? ` · ${partner}` : ''}
                {isWinner ? ' — wins' : isLeader && !matchOver ? ' · lead' : ''}
              </span>
              <span className="rummy-score-total">{p.score}</span>
              {roundOver || matchOver ? (
                <span className="rummy-score-delta">
                  {line
                    ? `${line.delta > 0 ? '+' : ''}${line.delta} this hand`
                    : '—'}
                </span>
              ) : (
                <span className="rummy-score-delta">
                  {tricks} trick{tricks === 1 ? '' : 's'} · {handPts} pts
                  {isRooster && state.phase === 'play'
                    ? ` · team ${state.teamTaken[teamOfIndex(pi)]}`
                    : ''}
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
          {state.phase === 'bid'
            ? `Auction · high ${state.bidAmount || '—'}`
            : state.phase === 'nest' || state.phase === 'trump'
              ? `Nest · bury then name trump`
              : `Trick · ${state.trick.length}/${state.players.length}`}
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
          {state.phase === 'bid' || state.phase === 'nest' || state.phase === 'trump' ? (
            <div className="pile-empty">
              {state.phase === 'bid'
                ? 'Bidding…'
                : state.phase === 'nest'
                  ? 'Bidder arranging nest…'
                  : 'Naming trump…'}
            </div>
          ) : state.trick.length === 0 ? (
            <div className="pile-empty">
              {state.lastTrickNote ? 'Next lead…' : 'Waiting for lead'}
            </div>
          ) : (
            state.trick.map((t) => (
              <div key={t.card.id} className="trick-play">
                <span className="muted tiny">
                  {state.players.find((p) => p.seat === t.seat)?.name ?? `P${t.seat + 1}`}
                </span>
                <CardView card={t.card} size="lg" palette={palette} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`rummy-hand${yourTurn ? ' is-active' : ''}`}>
        {orderedHand.map((c) => {
          const dim =
            state.phase === 'play' && yourTurn && !legal.has(c.id) ? ' is-illegal' : ''
          const canClick =
            yourTurn &&
            (state.phase === 'pass' ||
              state.phase === 'nest' ||
              (state.phase === 'play' && legal.has(c.id)))
          return (
            <button
              key={c.id}
              type="button"
              className={`rummy-hand-slot${selected.includes(c.id) ? ' is-selected' : ''}${dim}${dragOverId === c.id ? ' is-drop-target' : ''}`}
              disabled={state.phase === 'play' ? !canClick : false}
              draggable
              onDragStart={(e) => {
                dragFromId.current = c.id
                dragged.current = false
                e.dataTransfer.setData('text/plain', c.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDrag={(e) => {
                if (e.clientX !== 0 || e.clientY !== 0) dragged.current = true
              }}
              onDragEnd={() => {
                dragFromId.current = null
                setDragOverId(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOverId !== c.id) setDragOverId(c.id)
              }}
              onDragLeave={() => {
                if (dragOverId === c.id) setDragOverId(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragFromId.current || e.dataTransfer.getData('text/plain')
                setDragOverId(null)
                dragFromId.current = null
                if (from) moveCardInHand(from, c.id)
              }}
              onClick={() => toggle(c.id)}
            >
              <CardView card={c} size="md" selected={selected.includes(c.id)} palette={palette} />
            </button>
          )
        })}
      </div>
      <p className="muted tiny rummy-hand-hint">Drag cards to rearrange · Sort groups by color</p>

      <div className="rummy-actions">
        <button type="button" className="btn ghost" onClick={sortMyHand}>
          Sort hand
        </button>

        {!roundOver && !matchOver && state.phase === 'pass' ? (
          <button
            type="button"
            className="btn primary"
            disabled={!yourTurn || selected.length !== 3}
            onClick={() => play({ t: 'pass', cardIds: selected })}
          >
            Pass 3 {passDirectionLabel(state.passDirection)}
          </button>
        ) : null}

        {!roundOver && !matchOver && state.phase === 'bid' && yourTurn ? (
          <>
            <button type="button" className="btn secondary" onClick={() => play({ t: 'passBid' })}>
              Pass
            </button>
            {bidOptions.slice(0, 8).map((amount) => (
              <button
                key={amount}
                type="button"
                className="btn primary"
                onClick={() => play({ t: 'bid', amount })}
              >
                Bid {amount}
              </button>
            ))}
            {bidOptions.length > 8 ? (
              <label className="trick-bid-more">
                More
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const amount = Number(e.target.value)
                    if (amount) play({ t: 'bid', amount })
                    e.target.value = ''
                  }}
                >
                  <option value="" disabled>
                    …
                  </option>
                  {bidOptions.slice(8).map((amount) => (
                    <option key={amount} value={amount}>
                      {amount}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}

        {!roundOver && !matchOver && state.phase === 'nest' ? (
          <button
            type="button"
            className="btn primary"
            disabled={!yourTurn || selected.length !== ROOSTER_NEST_SIZE}
            onClick={() => play({ t: 'nestDiscard', cardIds: selected })}
          >
            Bury {selected.length}/{ROOSTER_NEST_SIZE}
          </button>
        ) : null}

        {!roundOver && !matchOver && state.phase === 'trump' && yourTurn ? (
          <>
            {SUITS.map((suit) => (
              <button
                key={suit}
                type="button"
                className="btn primary"
                onClick={() => play({ t: 'nameTrump', suit })}
              >
                Trump {ROOSTER_COLOR[suit as Exclude<Suit, 'J'>]}
              </button>
            ))}
          </>
        ) : null}
      </div>

      <p className="muted tiny">{state.log.slice(-3).join(' · ')}</p>
    </div>
  )
}
