import { useState } from 'react'
import { coachAdvice } from '../core/coach'
import { isBetaVariant, variantLabel } from '../core/houseRules'
import { discardNeedsGoOutConsent, legalHandIndexes, readyToAskPartnerGoOut } from '../core/rules'
import { partnerIndex } from '../core/score'
import type { MatchState } from '../core/types'
import { initialMeldMinimum } from '../core/variants'
import { BetaVariantNotice } from './BetaVariantNotice'
import { MeldBuilder } from './MeldBuilder'
import { MeldTray } from './MeldTray'
import { Piles } from './Piles'
import { PlayerHandCounts } from './PlayerHandCounts'
import { RankHand } from './RankHand'

export type DisconnectWaitInfo = {
  name: string
  until: number
  /** True when this client is the one who left and may still rejoin. */
  self?: boolean
}

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
  onTakeSequenceTop?: (meldIndex: number) => void
  onPass?: () => void
  onMeld: () => void
  onAdd: (meldIndex: number, cardIds?: string[]) => void
  onDiscard: () => void
  onClear: () => void
  onDropGroup: (index: number) => void
  onMenu: () => void
  onContinue: () => void
  onConsent: (accept: boolean) => void
  onRequestGoOut?: () => void
  onGoOut?: () => void
  showOppBooks?: boolean
  showOurBooks?: boolean
  coachTips?: boolean
  disconnectWait?: DisconnectWaitInfo | null
  onQuitWaiting?: () => void
  waitSecondsLeft?: number
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
  onTakeSequenceTop,
  onPass,
  onMeld,
  onAdd,
  onDiscard,
  onClear,
  onDropGroup,
  onMenu,
  onContinue,
  onConsent,
  onRequestGoOut,
  onGoOut,
  showOppBooks = true,
  showOurBooks = true,
  coachTips = false,
  disconnectWait = null,
  onQuitWaiting,
  waitSecondsLeft = 0,
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
  const variantName = variantLabel(state.config.variant)
  const betaGame = isBetaVariant(state.config.variant)
  const partner = state.players.find((p, i) => p.team === myTeam && i !== localIndex)
  const pendingOut = state.pendingGoOut
  const iAnswerGoOut = Boolean(
    pendingOut && state.phase === 'awaitingGoOutConsent' && partnerIndex(state, pendingOut.playerIndex) === localIndex,
  )
  const iAskedGoOut = Boolean(
    pendingOut && state.phase === 'awaitingGoOutConsent' && pendingOut.playerIndex === localIndex,
  )
  const asker = pendingOut ? state.players[pendingOut.playerIndex] : null
  const booksHidden = !showOppBooks || !showOurBooks
  const partnerName = partner?.displayName ?? 'your partner'
  const readyToAsk = readyToAskPartnerGoOut(state, localIndex)
  const [pendingAsk, setPendingAsk] = useState(false)

  const handleDiscard = () => {
    const id = [...selectedIds][0] ?? me.hand[0]?.id
    if (!id) return
    if (discardNeedsGoOutConsent(state, localIndex, id)) {
      setPendingAsk(true)
      return
    }
    onDiscard()
  }

  const confirmAskPartner = () => {
    setPendingAsk(false)
    if (onRequestGoOut) onRequestGoOut()
    else if (me.hand.length === 0) onGoOut?.()
    else onDiscard()
  }

  return (
    <div className={`table-root ${myTurn ? 'is-my-turn' : ''} ${booksHidden ? 'is-tray-hidden' : ''}`.trim()}>
      <div className="table-felt" />
      <div className="table-brass" />

      <header className="board-top">
        <div className="brand-mark">
          <span>HAND &amp; FOOT</span>
          <small>/ CANASTA</small>
        </div>
        <div className="score-ticker">
          <div>
            <em>We</em> {state.teams[myTeam]!.score}
          </div>
          <div>
            <em>They</em> {state.teams[otherTeam]!.score}
          </div>
          <div>
            <em>{variantName}</em>
            {betaGame ? <span className="beta-badge inline">Beta</span> : null}{' '}
            {state.config.rounds ? `R${state.round}/4` : `to ${state.config.playTo}`}
          </div>
          <div>
            <em>Meld</em> {state.teams[myTeam]!.hasInitialMeld ? '✓' : need}
          </div>
        </div>
      </header>

      <PlayerHandCounts state={state} localIndex={localIndex} />

      {betaGame ? <BetaVariantNotice compact className="board-beta" /> : null}

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
            {state.config.footSize > 0 ? <span>{p.footPickedUp ? 'Foot open' : 'Foot sealed'}</span> : null}
            {i === localIndex ? <em>You</em> : p.team === myTeam ? <em>Partner</em> : <em>Opp</em>}
          </div>
        ))}
      </div>

      {showOppBooks ? (
        <MeldTray
          title="Their books"
          melds={state.teams[otherTeam]!.melds}
          config={state.config}
          redThrees={state.teams[otherTeam]!.redThrees.length}
        />
      ) : null}

      <Piles state={state} localIndex={localIndex} selectedIds={selectedIds} onDraw={onDraw} onTakePile={onTakePile} />

      {showOurBooks ? (
        <MeldTray
          title={partner ? `Our books · with ${partner.displayName}` : 'Our books'}
          melds={state.teams[myTeam]!.melds}
          config={state.config}
          redThrees={state.teams[myTeam]!.redThrees.length}
          highlight
          onMeldClick={
            myTurn && !aiThinking
              ? (i) => {
                  if (state.phase === 'awaitingDraw' && onTakeSequenceTop) onTakeSequenceTop(i)
                  else if (state.phase === 'awaitingPlay') onAdd(i)
                }
              : undefined
          }
        />
      ) : null}

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
        onDiscard={handleDiscard}
        onPass={onPass}
        onClear={onClear}
        onDropGroup={onDropGroup}
        onRequestGoOut={
          readyToAsk && onRequestGoOut && myTurn && !aiThinking && !iAskedGoOut
            ? () => setPendingAsk(true)
            : undefined
        }
        partnerName={partnerName}
      />

      {readyToAsk && myTurn && !aiThinking && !pendingAsk && !iAskedGoOut && !disconnectWait && onRequestGoOut ? (
        <div className="go-out-ask-bar">
          <p>
            You are ready to go out. Your partner must approve before the hand ends.
          </p>
          <button type="button" className="btn secondary" onClick={() => setPendingAsk(true)}>
            Ask {partnerName} for permission
          </button>
        </div>
      ) : null}

      {disconnectWait ? (
        <div className="banner-overlay">
          <div className="banner-card">
            <h2>Connection lost</h2>
            <p>
              {disconnectWait.self
                ? 'You left the table. Re-sit in the same seat to resume, or quit.'
                : `${disconnectWait.name} has left the game. Waiting ${Math.max(0, waitSecondsLeft)} seconds for them to return. You may wait or quit.`}
            </p>
            {onQuitWaiting ? (
              <button type="button" className="btn ghost" onClick={onQuitWaiting}>
                Quit match
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingAsk && !disconnectWait ? (
        <div className="banner-overlay">
          <div className="banner-card">
            <h2>Ask to go out?</h2>
            <p>
              It looks like you want to go out. Before you do, you must ask {partnerName} for permission. Shall I ask
              your partner?
            </p>
            <button
              type="button"
              className="btn primary"
              onClick={confirmAskPartner}
            >
              Yes — ask {partnerName}
            </button>
            <button type="button" className="btn ghost" onClick={() => setPendingAsk(false)}>
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      {myTurn &&
      !aiThinking &&
      !pendingAsk &&
      !disconnectWait &&
      me.hand.length === 0 &&
      state.phase === 'awaitingPlay' &&
      onGoOut ? (
        <div className="banner-overlay">
          <div className="banner-card">
            {readyToAsk && onRequestGoOut ? (
              <>
                <h2>Ask to go out?</h2>
                <p>
                  It looks like you want to go out. Before you do, you must ask {partnerName} for permission. Shall I
                  ask your partner?
                </p>
                <button type="button" className="btn primary" onClick={confirmAskPartner}>
                  Yes — ask {partnerName}
                </button>
              </>
            ) : (
              <>
                <h2>Go out</h2>
                <p>You have no cards left. That ends the hand if your team has a canasta (or the required books).</p>
                <button type="button" className="btn primary" onClick={onGoOut}>
                  Go out
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {iAskedGoOut && !disconnectWait ? (
        <div className="banner-overlay">
          <div className="banner-card">
            <h2>Waiting on partner</h2>
            <p>
              Asking {partnerName} for permission to go out. Play pauses until they answer Yes or Not yet.
            </p>
          </div>
        </div>
      ) : null}

      {iAnswerGoOut && asker && !disconnectWait ? (
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
  )
}
