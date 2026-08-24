import { suitGlyph, type Card } from '../core/cards'

function centerMark(rank: Card['rank']): string {
  if (rank === 'JOKER') return '★'
  return rank
}

export function CardFace({ card }: { card: Card }) {
  const pip = card.rank === 'JOKER' ? '★' : suitGlyph(card.suit)
  const label = card.rank === 'JOKER' ? '★' : card.rank
  const ten = card.rank === '10'
  const joker = card.rank === 'JOKER'

  return (
    <span className={`cn-card-face ${ten ? 'is-ten' : ''} ${joker ? 'is-joker' : ''}`}>
      <span className="cn-card-corner tl">
        <em>{label}</em>
        <i>{pip}</i>
      </span>
      <span className="cn-card-center" aria-hidden>
        <strong className="cn-card-giant">{centerMark(card.rank)}</strong>
        <i className="cn-card-suit">{pip}</i>
      </span>
      <span className="cn-card-corner br">
        <em>{label}</em>
        <i>{pip}</i>
      </span>
    </span>
  )
}
