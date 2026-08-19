import { LayoutGroup } from 'framer-motion'
import { coachAdvice } from '../core/coach'
import { legalHandIndexes } from '../core/rules'
import { partnerIndex } from '../core/score'
import type { MatchState } from '../core/types'
import { initialMeldMinimum } from '../core/variants'
import { MeldBuilder } from './MeldBuilder'
import { MeldTray } from './MeldTray'
import { Piles } from './Piles'
import { RankHand } from './RankHand'

type Props = {
  state: MatchState
  localIndex: number
  selectedIds: Set<string>
  parkedIds: Set<string>
  meldGroups: string[][]
  aiThinking: boolean
  onToggle: (id: string) => void
  onToggleRank: (ids: string[]) => void
  onDraw: () => void
  onTakePile: () => void
  onMeld: () => void
  onAdd: (meldIndex: number) => void
  onDiscard: () => void
  onClear: () => void
  onDropGroup: (index: number) => void
  onMenu: () => void
  onContinue: () => void
  onConsent: (accept: boolean) => void
  onGoOut?: () => void
  coachTips?: boolean
  onCoachTips?: (on: boolean) => void
}

export function GameBoard({
  state,
  localIndex,
  selectedIds,
  parkedIds,
  meldGroups,
  aiThinking,
  onToggle,
  onToggleRank,
  onDraw,
  onTakePile,
  onMeld,
  onAdd,
  onDiscard,
  onClear,
  onDropGroup,
  onMenu,
  onContinue,
  onConsent,
  onGoOut,
  coachTips = false,
  onCoachTips,
}: Props) {
  const me = state.players[localIndex]!
  const myTeam = me.team
  const otherTeam = (myTeam === 0 ? 1 : 0) as 0 | 1
  const legal = legalHandIndexes(state, localIndex)
  const legalIds = new Set(me.hand.filter((_, i) => legal.has(i)).map((c) => c.id))
  const advice = coachAdvice(state, localIndex, { tips: coachTips, selectedIds })
  const coachLine = aiThinking ? `${state.players[state.currentPlayer]!.displayName} is thinking…` : advice.headline
  const myTurn = state.currentPlayer === localIndex && (state.phase === 'awaitingDraw' || state.phase === 'awaitingPlay')
  const need = initialMeldMinimum(state.config, state.teams[myTeam]!.score, state.round)
  const variant = state.config.variant === 'canasta' ? 'Canasta' : 'Hand & Foot'
  const partner = state.players.find((p, i) => p.team === myTeam && i !== localIndex)
  const pendingOut = state.pendingGoOut
  const iAnswerGoOut = Boolean(
    pendingOut && state.phase === 'awaitingGoOutConsent' && partnerIndex(state, pendingOut.playerIndex) === localIndex,
  )
  const asker = pendingOut ? state.players[pendingOut.playerIndex] : null

  return (
    <LayoutGroup>
    <div className={`table-root ${myTurn ? 'is-my-turn' : ''}`}>
      <div className="table-felt" />
      <div className="table-brass" />

      <header className="board-top">
        <div className="brand-mark">
          <span>CANASTA</span>
          <small>& HAND AND FOOT</small>
        </div>
        <div className="score-ticker">
          <div>
            <em>We</em> {state.teams[myTeam]!.score}
          </div>
          <div>
            <em>They</em> {state.teams[otherTeam]!.score}
          </div>
          <div>
            <em>{variant}</em> {state.config.rounds ? `R${state.round}/4` : `to ${state.config.playTo}`}
          </div>
          <div>
            <em>Meld</em> {state.teams[myTeam]!.hasInitialMeld ? '✓' : need}
          </div>
        </div>
        <div className="board-top-actions">
          {onCoachTips ? (
            <button
              type="button"
              className={`btn ghost tiny-btn ${coachTips ? 'is-on' : ''}`}
              onClick={() => onCoachTips(!coachTips)}
            >
              {coachTips ? 'Coach on' : 'Coach off'}
            </button>
          ) : null}
          <button type="button" className="btn ghost tiny-btn" onClick={onMenu}>
            Menu
          </button>
        </div>
      </header>

      <p className={`turn-banner ${myTurn ? 'is-you' : 'is-other'}`}>
        {aiThinking
          ? `${state.players[state.currentPlayer]!.displayName}'s turn`
          : myTurn && state.phase === 'awaitingDraw'
            ? 'Your turn to draw'
            : myTurn && state.phase === 'awaitingPlay'
              ? 'Your turn — meld or discard'
              : `${state.players[state.currentPlayer]!.displayName}'s turn`}
      </p>
      <div className={`coach ${coachTips && advice.tip && !aiThinking ? 'has-tip' : ''}`}>
        <p className="coach-status">{coachLine}</p>
        {coachTips && advice.tip && !aiThinking ? (
          <p className="coach-tip">
            <em>Coach</em>
            {advice.tip}
          </p>
        ) : null}
      </div>

      <div className="seats">
        {state.players.map((p, i) => (
          <div
            key={p.seat}
            className={`seat ${state.currentPlayer === i ? 'is-turn' : ''} ${p.team === myTeam ? 'is-partner' : ''} ${i === localIndex ? 'is-you' : ''}`}
          >
            <strong>{i === localIndex ? `You · ${p.seat + 1}` : p.displayName}</strong>
            {state.currentPlayer === i ? <span className="turn-pill">Turn</span> : null}
            <span>{p.hand.length} in hand</span>
            {state.config.footSize > 0 ? <span>{p.footPickedUp ? 'Foot open' : 'Foot sealed'}</span> : null}
            {i === localIndex ? <em>You</em> : p.team === myTeam ? <em>Partner</em> : <em>Opp</em>}
          </div>
        ))}
      </div>

      <MeldTray
        title="Their books"
        melds={state.teams[otherTeam]!.melds}
        config={state.config}
        redThrees={state.teams[otherTeam]!.redThrees.length}
      />

      <Piles state={state} localIndex={localIndex} selectedIds={selectedIds} onDraw={onDraw} onTakePile={onTakePile} />

      <MeldTray
        title={partner ? `Our books · with ${partner.displayName}` : 'Our books'}
        melds={state.teams[myTeam]!.melds}
        config={state.config}
        redThrees={state.teams[myTeam]!.redThrees.length}
        highlight
        onMeldClick={onAdd}
      />

      <RankHand
        hand={me.hand}
        selectedIds={selectedIds}
        parkedIds={parkedIds}
        legalIds={legalIds}
        myTurn={myTurn && !aiThinking}
        onToggle={onToggle}
        onToggleRank={(_rank, ids) => onToggleRank(ids)}
      />

      <MeldBuilder
        state={state}
        localIndex={localIndex}
        groups={meldGroups}
        onMeld={onMeld}
        onAdd={onAdd}
        onDiscard={onDiscard}
        onClear={onClear}
        onDropGroup={onDropGroup}
      />

      {myTurn && !aiThinking && me.hand.length === 0 && state.phase === 'awaitingPlay' && onGoOut ? (
        <div className="banner-overlay">
          <div className="banner-card">
            <h2>Go out</h2>
            <p>You have no cards left. That ends the hand if your team has a canasta (or the required books).</p>
            <button type="button" className="btn primary" onClick={onGoOut}>
              Go out
            </button>
          </div>
        </div>
      ) : null}

      {iAnswerGoOut && asker ? (
        <div className="banner-overlay">
          <div className="banner-card">
            <h2>May I go out?</h2>
            <p>
              {asker.displayName} is your partner and is ready to go out. Say yes only if you have picked up your
              Foot and you are ready for the hand to end.
            </p>
            <button type="button" className="btn primary" onClick={() => onConsent(true)}>
              Yes — go out
            </button>
            <button type="button" className="btn ghost" onClick={() => onConsent(false)}>
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      {state.phase === 'roundEnd' || state.phase === 'matchEnd' ? (
        <div className="banner-overlay chandelier">
          <div className="banner-card scoreboard">
            <p className="brand-kicker">{state.phase === 'matchEnd' ? 'Final' : `Hand ${state.round}`}</p>
            <h2>{state.lastMessage}</h2>
            <div className="score-split">
              <div>
                <em>We</em>
                <strong>{state.teams[myTeam]!.score}</strong>
              </div>
              <div>
                <em>They</em>
                <strong>{state.teams[otherTeam]!.score}</strong>
              </div>
            </div>
            {state.phase === 'roundEnd' ? (
              <button type="button" className="btn primary" onClick={onContinue}>
                Next hand
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={onMenu}>
                Table lobby
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
    </LayoutGroup>
  )
}
