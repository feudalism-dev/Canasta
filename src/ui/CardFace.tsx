import { suitGlyph, type Card } from '../core/cards'
import {
  isRoosterBird,
  roosterColorLabel,
  roosterFaceLabel,
  ROOSTER_COLOR_SHORT,
} from '../core/trick/roosterDeck'

function centerMark(rank: Card['rank']): string {
  if (rank === 'JOKER') return '★'
  return rank
}

export function CardFace({ card, palette = 'french' }: { card: Card; palette?: 'french' | 'rooster' }) {
  if (palette === 'rooster') {
    const bird = isRoosterBird(card)
    const label = roosterFaceLabel(card)
    const pip = bird ? '★' : ROOSTER_COLOR_SHORT[card.suit as keyof typeof ROOSTER_COLOR_SHORT] ?? '?'
    const color = bird ? 'is-rooster-bird' : `is-rooster-${card.suit}`
    return (
      <span className={`cn-card-face is-rooster ${color}`} title={roosterColorLabel(card)}>
        <span className="cn-card-corner tl">
          <em>{label}</em>
          <i>{pip}</i>
        </span>
        <span className="cn-card-center" aria-hidden>
          <strong className="cn-card-giant">{bird ? '★' : label}</strong>
          <i className="cn-card-suit">{bird ? 'Rooster' : roosterColorLabel(card)}</i>
        </span>
        <span className="cn-card-corner br">
          <em>{label}</em>
          <i>{pip}</i>
        </span>
      </span>
    )
  }

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
