import { motion } from 'framer-motion'
import { isWild, rankLabel } from '../core/cards'
import { claimCardsForPile, peekDiscard, pileIsStopped } from '../core/rules'
import type { MatchState } from '../core/types'
import { CardView } from './CardView'
import { assets } from './assets'

type Props = {
  state: MatchState
  localIndex: number
  onDraw: () => void
  onTakePile: () => void
}

export function Piles({ state, localIndex, onDraw, onTakePile }: Props) {
  const top = peekDiscard(state)
  const stopped = pileIsStopped(state)
  const claim = claimCardsForPile(state, localIndex)
  const myDraw = state.phase === 'awaitingDraw' && state.currentPlayer === localIndex
  const me = state.players[localIndex]!
  const freeze = state.discardFrozen
  const sideways = Boolean(top && (isWild(top) || freeze))

  return (
    <div className="piles">
      <button type="button" className="pile-slot" onClick={onDraw} disabled={!myDraw}>
        <span className="pile-label">Stock · {state.stock.length}</span>
        <CardView facedown size="lg" />
      </button>
      <button
        type="button"
        className={`pile-slot discard ${claim && myDraw ? 'can-take' : ''} ${freeze ? 'is-frozen' : ''}`}
        onClick={onTakePile}
        disabled={!myDraw || !claim}
      >
        <span className="pile-label">
          Discard · {state.discard.length}
          {freeze ? ' · frozen' : ''}
          {stopped ? ' · stop' : ''}
        </span>
        {top ? (
          <motion.div
            key={top.id}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={sideways ? 'side-wrap' : undefined}
          >
            <CardView card={top} size="lg" sideways={sideways} />
          </motion.div>
        ) : (
          <div className="pile-empty">Empty</div>
        )}
        {claim && myDraw && top ? (
          <span className="preview">Take {state.discard.length} · need {rankLabel(top.rank)}s</span>
        ) : null}
      </button>
      {state.config.footSize > 0 ? (
        <div className="pile-slot foot">
          <span className="pile-label">{me.footPickedUp ? 'Foot in hand' : `Foot · ${me.foot.length}`}</span>
          {me.footPickedUp ? (
            <div className="foot-open">OPEN</div>
          ) : (
            <motion.div initial={false} animate={{ rotateX: 0 }}>
              <CardView facedown size="lg" />
              <img src={assets.cardBack} alt="" className="sr-only" />
            </motion.div>
          )}
        </div>
      ) : null}
    </div>
  )
}
