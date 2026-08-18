import { motion } from 'framer-motion'
import { canastaKind } from '../core/melds'
import type { Meld, VariantConfig } from '../core/types'
import { CardView } from './CardView'

type Props = {
  title: string
  melds: Meld[]
  config: VariantConfig
  redThrees: number
  highlight?: boolean
  onMeldClick?: (index: number) => void
}

export function MeldTray({ title, melds, config, redThrees, highlight, onMeldClick }: Props) {
  return (
    <section className={`meld-tray ${highlight ? 'is-ours' : ''}`}>
      <header>
        <h3>{title}</h3>
        {redThrees > 0 ? <span className="red3-chip">{redThrees} red 3s</span> : null}
      </header>
      <div className="meld-row">
        {melds.length === 0 ? <p className="muted tiny">No melds yet</p> : null}
        {melds.map((m, i) => {
          const kind = canastaKind(m, config.canastaSize)
          const stamp = kind === 'natural' ? 'clean' : kind === 'mixed' ? 'dirty' : kind === 'wild' ? 'wild' : undefined
          const top = m.cards[m.cards.length - 1]
          return (
            <motion.button
              type="button"
              key={`${m.rank}-${i}`}
              className={`book ${m.closed || kind !== 'none' ? 'is-closed' : ''} ${kind !== 'none' ? `is-${kind}` : ''}`}
              onClick={() => onMeldClick?.(i)}
              initial={kind !== 'none' ? { scale: 0.86, rotate: -6 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            >
              {kind !== 'none' ? (
                <CardView card={top} size="sm" stamp={stamp} facedown={false} />
              ) : (
                <div className="open-spread">
                  {m.cards.slice(0, 4).map((c) => (
                    <CardView key={c.id} card={c} size="sm" />
                  ))}
                  {m.cards.length > 4 ? <span className="more">+{m.cards.length - 4}</span> : null}
                </div>
              )}
              <span className="book-cap">
                {m.rank === 'WILD' ? 'Wild' : m.rank} · {m.cards.length}
              </span>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
