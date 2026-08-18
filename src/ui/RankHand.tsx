import { groupByRank, isWild, type Card, type Rank } from '../core/cards'
import { CardView } from './CardView'

type Props = {
  hand: Card[]
  selectedIds: Set<string>
  legalIds: Set<string>
  myTurn: boolean
  onToggle: (id: string) => void
  onToggleRank: (rank: Rank, ids: string[]) => void
}

const ORDER: Rank[] = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '3', '2', 'JOKER']

export function RankHand({ hand, selectedIds, legalIds, myTurn, onToggle, onToggleRank }: Props) {
  const groups = groupByRank(hand)
  const ranks = ORDER.filter((r) => (groups.get(r) || []).length > 0)
  return (
    <div className={`rank-hand ${myTurn ? 'is-turn' : ''}`}>
      {ranks.map((rank) => {
        const cards = groups.get(rank) || []
        const ids = cards.map((c) => c.id)
        const allOn = ids.every((id) => selectedIds.has(id))
        return (
          <div key={rank} className={`rank-group ${allOn ? 'is-on' : ''}`}>
            <button
              type="button"
              className="rank-label"
              onClick={() => onToggleRank(rank, ids)}
            >
              {rank === 'JOKER' ? 'Wild ★' : isWild(cards[0]!) ? 'Deuces' : rank}
              <span>{cards.length}</span>
            </button>
            <div className="rank-cards">
              {cards.map((c) => (
                <CardView
                  key={c.id}
                  card={c}
                  size="md"
                  selected={selectedIds.has(c.id)}
                  legal={legalIds.has(c.id)}
                  dimmed={myTurn && !legalIds.has(c.id) && !selectedIds.has(c.id)}
                  onClick={() => onToggle(c.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
