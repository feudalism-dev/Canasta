import { isRedSuit, rankLabel, type Card } from '../core/cards'
import { assets } from './assets'
import { CardFace } from './CardFace'

type Size = 'sm' | 'md' | 'book' | 'lg'

export type BookStamp = 'clean' | 'dirty' | 'wild' | 'samba' | 'bolivia'

type Props = {
  card?: Card
  facedown?: boolean
  size?: Size
  legal?: boolean
  selected?: boolean
  parked?: boolean
  dimmed?: boolean
  sideways?: boolean
  stamp?: BookStamp
  onClick?: () => void
}

function stampLabel(stamp: BookStamp): string {
  if (stamp === 'clean') return 'CLEAN'
  if (stamp === 'dirty') return 'DIRTY'
  if (stamp === 'samba') return 'SAMBA'
  if (stamp === 'bolivia') return 'BOLIVIA'
  return 'WILD'
}

function cardToneClass(card: Card): string {
  if (card.rank === 'JOKER') return card.id.endsWith('-1') ? 'is-red' : 'is-black'
  return isRedSuit(card.suit) ? 'is-red' : 'is-black'
}

export function CardView({
  card,
  facedown,
  size = 'md',
  legal,
  selected,
  parked,
  dimmed,
  sideways,
  stamp,
  onClick,
}: Props) {
  const cls = [
    'cn-card',
    `is-${size}`,
    facedown ? 'is-back' : '',
    legal ? 'is-legal' : '',
    selected ? 'is-selected' : '',
    parked ? 'is-parked' : '',
    dimmed ? 'is-dim' : '',
    sideways ? 'is-side' : '',
    card && !facedown ? cardToneClass(card) : '',
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
    <Tag className={cls} {...clickProps} aria-label={`${rankLabel(card.rank)} of ${card.suit}`}>
      <CardFace card={card} />
      {stamp ? <span className="cn-stamp">{stampLabel(stamp)}</span> : null}
    </Tag>
  )
}
