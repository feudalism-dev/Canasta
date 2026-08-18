import { motion } from 'framer-motion'
import { isWild, rankLabel } from '../core/cards'
import { peekDiscard, pileIsStopped, planPileTake } from '../core/rules'
import type { MatchState } from '../core/types'
import { CardView } from './CardView'
import { assets } from './assets'

type Props = {
  state: MatchState
  localIndex: number
  selectedIds: Set<string>
  onDraw: () => void
  onTakePile: () => void
}

export function Piles({ state, localIndex, selectedIds, onDraw, onTakePile }: Props) {
  const top = peekDiscard(state)
  const stopped = pileIsStopped(state)
  const myDraw = state.phase === 'awaitingDraw' && state.currentPlayer === localIndex
  const me = state.players[localIndex]!
  const freeze = state.discardFrozen
  const sideways = Boolean(top && (isWild(top) || freeze))
  const plan = myDraw ? planPileTake(state, localIndex, [...selectedIds]) : { ok: false as const, error: '' }
  const canTake = Boolean(plan.ok)

  return (
    <div className="piles">
      <button type="button" className="pile-slot" onClick={onDraw} disabled={!myDraw}>
        <span className="pile-label">Stock · {state.stock.length}</span>
        <CardView facedown size="lg" />
        {myDraw ? <span className="preview">Draw</span> : null}
      </button>
      <button
        type="button"
        className={`pile-slot discard ${canTake ? 'can-take' : ''} ${freeze ? 'is-frozen' : ''}`}
        onClick={onTakePile}
        disabled={!myDraw || stopped}
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
        {myDraw && top && !stopped ? (
          <span className="preview">
            {canTake
              ? `Take ${state.discard.length} · ${rankLabel(top.rank)}s`
              : freeze
                ? `Frozen ${rankLabel(top.rank)} — click for why`
                : `Click to take if legal`}
          </span>
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
