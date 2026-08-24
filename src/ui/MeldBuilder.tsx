import { buildMeldFromPack, canAddCards, inferMeldRank, isSequenceMeld, validateMeldCards } from '../core/melds'
import { meldCountPoints, rankLabel, suitGlyph, type Card, type MeldRank } from '../core/cards'
import type { MatchState } from '../core/types'
import { initialMeldMinimum } from '../core/variants'
import { CardView } from './CardView'

type Props = {
  state: MatchState
  localIndex: number
  groups: string[][]
  onMeld: () => void
  onAdd: (meldIndex: number) => void
  onDiscard: () => void
  onPass?: () => void
  onClear: () => void
  onDropGroup: (index: number) => void
}

function inspectGroup(ids: string[], hand: Card[], config: MatchState['config']) {
  const cards = ids.map((id) => hand.find((c) => c.id === id)).filter((c): c is Card => Boolean(c))
  const pts = cards.reduce((n, c) => n + meldCountPoints(c), 0)
  const built = buildMeldFromPack(cards, config)
  if (!built.error && isSequenceMeld(built.meld)) {
    return {
      cards,
      pts,
      rank: null as MeldRank | null,
      label: `${suitGlyph(built.meld.suit ?? 'S')} sequence`,
      ok: true,
    }
  }
  const rank = inferMeldRank(cards)
  const err = rank ? validateMeldCards(cards, rank, config) : cards.length ? 'Need a complete set' : 'Empty'
  return { cards, pts, rank, label: null as string | null, ok: !err && Boolean(rank) }
}

export function MeldBuilder({
  state,
  localIndex,
  groups,
  onMeld,
  onAdd,
  onDiscard,
  onPass,
  onClear,
  onDropGroup,
}: Props) {
  const me = state.players[localIndex]!
  const team = state.teams[me.team]!
  const need = initialMeldMinimum(state.config, team.score, state.round)
  const inspected = groups.map((ids) => inspectGroup(ids, me.hand, state.config))
  const selected = inspected.flatMap((g) => g.cards)
  const pts = selected.reduce((n, c) => n + meldCountPoints(c), 0)
  const allComplete = inspected.length > 0 && inspected.every((g) => g.ok)
  const canMeld = allComplete && (team.hasInitialMeld || pts >= need)
  const addable =
    inspected.length === 1
      ? team.melds
          .map((m, i) => ({ i, m, err: canAddCards(m, selected, state.config) }))
          .filter((x) => !x.err)
      : []
  const one = selected.length === 1 && groups.length === 1
  const canPass =
    Boolean(onPass) &&
    state.phase === 'awaitingPlay' &&
    state.currentPlayer === localIndex &&
    me.hand.length === 1
  const canDiscard = one && state.phase === 'awaitingPlay' && state.currentPlayer === localIndex
  const showStaging = !team.hasInitialMeld && selected.length >= 2
  const meldLabel = !inspected.length
    ? 'Meld'
    : inspected.length === 1 && (inspected[0]!.label || inspected[0]!.rank)
      ? inspected[0]!.label
        ? `Meld ${inspected[0]!.cards.length}-card ${inspected[0]!.label}`
        : `Meld ${inspected[0]!.cards.length} ${inspected[0]!.rank === 'WILD' ? 'wilds' : inspected[0]!.rank}`
      : `Meld ${inspected.length} sets`

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
      {showStaging ? (
        <div className="proposed">
          <p className="proposed-cap">Private — others cannot see this</p>
          <div className="proposed-row">
            {inspected.map((g, i) => (
              <button
                type="button"
                key={`g-${i}`}
                className={`proposed-set ${g.ok ? 'is-ok' : 'is-short'}`}
                onClick={() => onDropGroup(i)}
                title="Remove this set"
              >
                <div className="proposed-spread">
                  {g.cards.slice(0, 4).map((c) => (
                    <CardView key={c.id} card={c} size="sm" />
                  ))}
                </div>
                <span>
                  {g.ok
                    ? g.label
                      ? `${g.label} · ${g.pts}`
                      : `${g.rank === 'WILD' ? 'Wild' : g.rank} · ${g.pts}`
                    : g.rank
                      ? `${rankLabel(g.rank)} · short`
                      : 'Short'}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="builder-actions">
        <button type="button" className="btn primary" disabled={!canMeld} onClick={onMeld}>
          {meldLabel}
        </button>
        {addable.map((x) => (
          <button key={x.i} type="button" className="btn secondary" onClick={() => onAdd(x.i)}>
            Add {selected.length} to{' '}
            {isSequenceMeld(x.m)
              ? `Run ${x.m.rank}${x.m.suit ? ` ${suitGlyph(x.m.suit)}` : ''}`
              : x.m.rank === 'WILD'
                ? 'wilds'
                : x.m.rank}
          </button>
        ))}
        <button type="button" className="btn ghost" disabled={!one || !canDiscard} onClick={onDiscard}>
          Discard
        </button>
        {onPass ? (
          <button type="button" className="btn ghost" disabled={!canPass} onClick={onPass}>
            Pass
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      {!team.hasInitialMeld && showStaging && !canMeld ? (
        <p className="hint">
          {allComplete
            ? `Need ${need}; these sets are ${pts}. Add another set, or Clear — nothing is on the table yet.`
            : 'Finish each set (two naturals plus a wild, or three naturals). A new rank starts the next set.'}
        </p>
      ) : null}
    </div>
  )
}
