import { isRedSuit, rankLabel, suitGlyph, type Card } from '../core/cards'
import { assets } from './assets'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  card?: Card
  facedown?: boolean
  size?: Size
  legal?: boolean
  selected?: boolean
  dimmed?: boolean
  sideways?: boolean
  stamp?: 'clean' | 'dirty' | 'wild'
  onClick?: () => void
}

export function CardView({
  card,
  facedown,
  size = 'md',
  legal,
  selected,
  dimmed,
  sideways,
  stamp,
  onClick,
}: Props) {
  const red = card ? isRedSuit(card.suit) : false
  const label = card ? (card.rank === 'JOKER' ? '★' : card.rank) : ''
  const pip = card ? (card.rank === 'JOKER' ? '★' : suitGlyph(card.suit)) : ''
  const cls = [
    'cn-card',
    `is-${size}`,
    facedown ? 'is-back' : '',
    legal ? 'is-legal' : '',
    selected ? 'is-selected' : '',
    dimmed ? 'is-dim' : '',
    sideways ? 'is-side' : '',
    red ? 'is-red' : 'is-black',
    stamp ? `is-stamp-${stamp}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const Tag = onClick ? 'button' : 'div'
  const clickProps = onClick ? { type: 'button' as const, onClick } : {}

  if (facedown || !card) {
    return (
      <Tag className={cls} {...clickProps} aria-label="Facedown card">
        <span className="cn-card-back" style={{ backgroundImage: `url(${assets.cardBack})` }} />
      </Tag>
    )
  }

  return (
    <Tag
      className={cls}
      {...clickProps}
      aria-label={`${rankLabel(card.rank)} of ${card.suit}`}
    >
      <span className="cn-card-corner tl">
        <em>{label}</em>
        <i>{pip}</i>
      </span>
      <span className="cn-card-pip">{pip}</span>
      <span className="cn-card-corner br">
        <em>{label}</em>
        <i>{pip}</i>
      </span>
      {stamp ? <span className="cn-stamp">{stamp === 'clean' ? 'CLEAN' : stamp === 'dirty' ? 'DIRTY' : 'WILD'}</span> : null}
    </Tag>
  )
}
