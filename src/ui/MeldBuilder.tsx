import { meldCountPoints, type Card } from '../core/cards'
import { canAddCards, inferMeldRank, validateMeldCards } from '../core/melds'
import type { MatchState } from '../core/types'
import { initialMeldMinimum } from '../core/variants'

type Props = {
  state: MatchState
  localIndex: number
  selected: Card[]
  onMeld: () => void
  onAdd: (meldIndex: number) => void
  onDiscard: () => void
  onClear: () => void
}

export function MeldBuilder({ state, localIndex, selected, onMeld, onAdd, onDiscard, onClear }: Props) {
  const me = state.players[localIndex]!
  const team = state.teams[me.team]!
  const need = initialMeldMinimum(state.config, team.score, state.round)
  const pts = selected.reduce((n, c) => n + meldCountPoints(c), 0)
  const rank = inferMeldRank(selected)
  const meldErr = rank ? validateMeldCards(selected, rank, state.config) : 'Select a rank'
  const canMeld = !meldErr && (team.hasInitialMeld || pts >= need)
  const addable = team.melds
    .map((m, i) => ({ i, m, err: canAddCards(m, selected, state.config) }))
    .filter((x) => !x.err)
  const one = selected.length === 1
  const canDiscard = one && state.phase === 'awaitingPlay' && state.currentPlayer === localIndex

  return (
    <div className="meld-builder">
      <div className="meter">
        <span>Initial meld</span>
        <div className="meter-bar">
          <i style={{ width: `${Math.min(100, (pts / Math.max(need, 1)) * 100)}%` }} />
        </div>
        <strong>
          {pts} / {need}
        </strong>
        {team.hasInitialMeld ? <em>Met</em> : null}
      </div>
      <div className="builder-actions">
        <button type="button" className="btn primary" disabled={!canMeld} onClick={onMeld}>
          {rank ? `Meld ${selected.length} ${rank === 'WILD' ? 'wilds' : rank}` : 'Meld'}
        </button>
        {addable.map((x) => (
          <button key={x.i} type="button" className="btn secondary" onClick={() => onAdd(x.i)}>
            Add to {x.m.rank}
          </button>
        ))}
        <button type="button" className="btn ghost" disabled={!one || !canDiscard} onClick={onDiscard}>
          Discard
        </button>
        <button type="button" className="btn ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      {meldErr && selected.length > 0 ? <p className="hint">{meldErr}</p> : null}
    </div>
  )
}
