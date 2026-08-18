import { whatShouldIDo } from '../core/coach'
import { legalHandIndexes } from '../core/rules'
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
  aiThinking: boolean
  onToggle: (id: string) => void
  onToggleRank: (ids: string[]) => void
  onDraw: () => void
  onTakePile: () => void
  onMeld: () => void
  onAdd: (meldIndex: number) => void
  onDiscard: () => void
  onClear: () => void
  onMenu: () => void
  onContinue: () => void
  onConsent: (accept: boolean) => void
}

export function GameBoard({
  state,
  localIndex,
  selectedIds,
  aiThinking,
  onToggle,
  onToggleRank,
  onDraw,
  onTakePile,
  onMeld,
  onAdd,
  onDiscard,
  onClear,
  onMenu,
  onContinue,
  onConsent,
}: Props) {
  const me = state.players[localIndex]!
  const myTeam = me.team
  const otherTeam = (myTeam === 0 ? 1 : 0) as 0 | 1
  const legal = legalHandIndexes(state, localIndex)
  const legalIds = new Set(me.hand.filter((_, i) => legal.has(i)).map((c) => c.id))
  const selectedCards = me.hand.filter((c) => selectedIds.has(c.id))
  const coach = whatShouldIDo(state, localIndex)
  const myTurn = state.currentPlayer === localIndex && (state.phase === 'awaitingDraw' || state.phase === 'awaitingPlay')
  const need = initialMeldMinimum(state.config, state.teams[myTeam]!.score, state.round)
  const variant = state.config.variant === 'canasta' ? 'Canasta' : 'Hand & Foot'
  const partner = state.players.find((p, i) => p.team === myTeam && i !== localIndex)

  return (
    <div className="table-root">
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
        <button type="button" className="btn ghost tiny-btn" onClick={onMenu}>
          Menu
        </button>
      </header>

      <p className="coach">{aiThinking ? 'The table is thinking…' : coach}</p>

      <div className="opponents">
        {state.players.map((p, i) =>
          i === localIndex ? null : (
            <div key={p.seat} className={`opp ${state.currentPlayer === i ? 'is-turn' : ''} ${p.team === myTeam ? 'is-partner' : ''}`}>
              <strong>{p.displayName}</strong>
              <span>{p.hand.length} in hand</span>
              {state.config.footSize > 0 ? <span>{p.footPickedUp ? 'Foot open' : 'Foot sealed'}</span> : null}
              {p.team === myTeam ? <em>Partner</em> : <em>Opp</em>}
            </div>
          ),
        )}
      </div>

      <MeldTray
        title="Their books"
        melds={state.teams[otherTeam]!.melds}
        config={state.config}
        redThrees={state.teams[otherTeam]!.redThrees.length}
      />

      <Piles state={state} localIndex={localIndex} onDraw={onDraw} onTakePile={onTakePile} />

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
        legalIds={legalIds}
        myTurn={myTurn && !aiThinking}
        onToggle={onToggle}
        onToggleRank={(_rank, ids) => onToggleRank(ids)}
      />

      <MeldBuilder
        state={state}
        localIndex={localIndex}
        selected={selectedCards}
        onMeld={onMeld}
        onAdd={onAdd}
        onDiscard={onDiscard}
        onClear={onClear}
      />

      {state.phase === 'awaitingGoOutConsent' && state.pendingGoOut ? (
        <div className="banner-overlay">
          <div className="banner-card">
            <h2>May I go out?</h2>
            <p>
              {state.players[state.pendingGoOut.playerIndex]!.displayName} is ready to go out.
              {partner && state.players.indexOf(partner) === localIndex
                ? ' You are the partner.'
                : ' Waiting on partner.'}
            </p>
            {partner && state.players.indexOf(partner) === localIndex ? (
              <>
                <button type="button" className="btn primary" onClick={() => onConsent(true)}>
                  Yes — go out
                </button>
                <button type="button" className="btn ghost" onClick={() => onConsent(false)}>
                  Not yet
                </button>
              </>
            ) : null}
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
  )
}
