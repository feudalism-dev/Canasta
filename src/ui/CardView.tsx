import { motion, useReducedMotion } from 'framer-motion'
import { isRedSuit, rankLabel, type Card } from '../core/cards'
import { assets } from './assets'
import { CardFace } from './CardFace'

type Size = 'sm' | 'md' | 'book' | 'lg'

type Props = {
  card?: Card
  facedown?: boolean
  size?: Size
  legal?: boolean
  selected?: boolean
  parked?: boolean
  dimmed?: boolean
  sideways?: boolean
  stamp?: 'clean' | 'dirty' | 'wild'
  layoutId?: string
  onClick?: () => void
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
  layoutId,
  onClick,
}: Props) {
  const reduceMotion = useReducedMotion()
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

  const label = facedown || !card ? 'Facedown card' : `${rankLabel(card.rank)} of ${card.suit}`
  const inner =
    facedown || !card ? (
      <span className="cn-card-back" style={{ backgroundImage: `url(${assets.cardBack})` }} />
    ) : (
      <>
        <CardFace card={card} />
        {stamp ? <span className="cn-stamp">{stamp === 'clean' ? 'CLEAN' : stamp === 'dirty' ? 'DIRTY' : 'WILD'}</span> : null}
      </>
    )
  const fly = layoutId
    ? {
        layoutId,
        initial: false as const,
        transition: reduceMotion
          ? { duration: 0 }
          : { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.85 },
      }
    : {}

  if (onClick) {
    return (
      <motion.button type="button" className={cls} onClick={onClick} aria-label={label} {...fly}>
        {inner}
      </motion.button>
    )
  }
  return (
    <motion.div className={cls} aria-label={label} {...fly}>
      {inner}
    </motion.div>
  )
}
