import { motion } from 'framer-motion'
import { isRedSuit, isWild, type Card } from '../core/cards'
import { canastaKind, sortMeldsForDisplay } from '../core/melds'
import type { Meld, VariantConfig } from '../core/types'
import { CardView } from './CardView'

type Props = {
  title: string
  melds: Meld[]
  config: VariantConfig
  redThrees: number
  highlight?: boolean
  flyCards?: boolean
  onMeldClick?: (index: number) => void
}

/** Closed books show a natural of the rank: red on clean, black on dirty. */
function bookFaceCard(meld: Meld, canastaSize: number): Card {
  const last = meld.cards[meld.cards.length - 1]!
  const kind = canastaKind(meld, canastaSize)
  if (kind === 'none') return last
  if (kind === 'wild') return meld.cards.find((c) => c.rank === 'JOKER') ?? last
  const naturals = meld.cards.filter((c) => !isWild(c))
  const wantRed = kind === 'natural'
  return naturals.find((c) => isRedSuit(c.suit) === wantRed) ?? naturals[0] ?? last
}

export function MeldTray({ title, melds, config, redThrees, highlight, flyCards = true, onMeldClick }: Props) {
  const ordered = sortMeldsForDisplay(melds, config.canastaSize)
  return (
    <section className={`meld-tray ${highlight ? 'is-ours' : ''}`}>
      <header>
        <h3>{title}</h3>
        {redThrees > 0 ? <span className="red3-chip">{redThrees} red 3s</span> : null}
      </header>
      <div className="meld-row">
        {melds.length === 0 ? <p className="muted tiny">No melds yet</p> : null}
        {ordered.map(({ meld: m, index: i }) => {
          const kind = canastaKind(m, config.canastaSize)
          const stamp = kind === 'natural' ? 'clean' : kind === 'mixed' ? 'dirty' : kind === 'wild' ? 'wild' : undefined
          const closed = kind !== 'none'
          const face = bookFaceCard(m, config.canastaSize)
          const rankText = m.rank === 'WILD' ? 'Wild' : m.rank
          return (
            <motion.button
              type="button"
              key={`${m.rank}-${i}`}
              className={`book ${closed ? 'is-closed' : 'is-open'} ${kind !== 'none' ? `is-${kind}` : ''}`}
              onClick={() => onMeldClick?.(i)}
              initial={closed && !flyCards ? { scale: 0.86, rotate: -6 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            >
              {closed ? (
                <div className="book-stack">
                  <i className="book-edge" />
                  <i className="book-edge" />
                  {m.cards.map((c, n) => {
                    const onTop = c.id === face.id
                    return (
                      <div
                        key={c.id}
                        className={`book-fly ${onTop ? 'is-top' : 'is-under'}`}
                        style={{ zIndex: onTop ? m.cards.length + 1 : n + 1 }}
                      >
                        <CardView
                          card={c}
                          size="book"
                          layoutId={flyCards ? c.id : undefined}
                          stamp={onTop ? stamp : undefined}
                          facedown={false}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="open-spread">
                  {m.cards.map((c, n) => (
                    <div key={c.id} className="spread-card" style={{ zIndex: n + 1 }}>
                      <CardView card={c} size="book" layoutId={flyCards ? c.id : undefined} />
                    </div>
                  ))}
                </div>
              )}
              <span className="book-cap">
                <strong>{rankText}</strong>
                <em>
                  {m.cards.length}
                  {stamp ? ` · ${stamp}` : ''}
                </em>
              </span>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
