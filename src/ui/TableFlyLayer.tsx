import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Card } from '../core/cards'
import { publicMeldCards, type PublicBoard } from '../core/publicBoard'
import { planTableFlights, type TableFlightPlan } from '../core/tableFlights'
import { CardView } from './CardView'

type Fly = {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  delay: number
  tilt: number
  card?: Card
  facedown?: boolean
}

function center(el: Element | null, root: HTMLElement, half = 22): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  const b = root.getBoundingClientRect()
  if (r.width < 2 && r.height < 2) return null
  return { x: r.left - b.left + r.width / 2 - half, y: r.top - b.top + r.height / 2 - half * 1.35 }
}

function ends(root: HTMLElement, plan: TableFlightPlan): { from: Element | null; to: Element | null } {
  const seat = root.querySelector(`[data-seat="${plan.seat}"]`)
  const stock = root.querySelector('[data-stock-pile]')
  const discard = root.querySelector('[data-discard-pile]')
  const book =
    plan.team != null && plan.rank
      ? root.querySelector(`[data-team-tray="${plan.team}"] [data-meld-rank="${plan.rank}"]`)
      : null
  const tray = plan.team != null ? root.querySelector(`[data-team-tray="${plan.team}"]`) : null
  if (plan.from === 'stock') return { from: stock, to: seat }
  if (plan.from === 'discard') return { from: discard, to: seat }
  if (plan.to === 'discard') return { from: seat, to: discard }
  return { from: seat, to: book || tray }
}

function facesFor(plan: TableFlightPlan, board: PublicBoard): { card?: Card; facedown?: boolean }[] {
  const n = Math.max(1, plan.count)
  if (plan.kind === 'draw' || plan.kind === 'takePile') {
    return Array.from({ length: n }, () => ({ facedown: true }))
  }
  if (plan.kind === 'discard' && plan.top) {
    return [{ card: { id: 'fly-disc', rank: plan.top.rank, suit: plan.top.suit } }]
  }
  if (plan.kind === 'meld' && plan.team != null && plan.rank) {
    const meld = board.teams[plan.team]!.melds.find((m) => m.rank === plan.rank)
    const cards = meld ? publicMeldCards(meld).slice(-n) : []
    if (cards.length) return cards.map((card) => ({ card }))
  }
  return Array.from({ length: n }, () => ({ facedown: true }))
}

export function TableFlyLayer({
  board,
  rootRef,
}: {
  board: PublicBoard
  rootRef: RefObject<HTMLDivElement | null>
}) {
  const prev = useRef(board)
  const seq = useRef(0)
  const reduce = useReducedMotion()
  const [flies, setFlies] = useState<Fly[]>([])

  useLayoutEffect(() => {
    const before = prev.current
    prev.current = board
    const root = rootRef.current
    if (reduce || !root || !board.live) {
      if (!board.live) setFlies([])
      return
    }
    const plans = planTableFlights(before, board)
    if (!plans.length) return
    const next: Fly[] = []
    for (const plan of plans) {
      const { from: fromEl, to: toEl } = ends(root, plan)
      const from = center(fromEl, root)
      const to = center(toEl, root)
      if (!from || !to) continue
      facesFor(plan, board).forEach((face, i) => {
        seq.current += 1
        const base = plan.kind === 'discard' ? 0.28 : plan.kind === 'meld' ? 0.12 : 0
        next.push({
          id: `fly-${seq.current}`,
          from: { x: from.x + i * 6, y: from.y + i * 4 },
          to: { x: to.x + i * 5, y: to.y + i * 3 },
          delay: base + i * 0.055,
          tilt: i % 2 === 0 ? -10 - i * 2 : 12 + i * 2,
          ...face,
        })
      })
    }
    if (next.length) setFlies((cur) => [...cur, ...next].slice(-12))
  }, [board, reduce, rootRef])

  return (
    <AnimatePresence>
      {flies.map((fly) => (
        <motion.div
          key={fly.id}
          className="spec-fly"
          initial={{ x: fly.from.x, y: fly.from.y, scale: 0.82, rotate: fly.tilt, opacity: 0.96 }}
          animate={{ x: fly.to.x, y: fly.to.y, scale: 1, rotate: fly.tilt * 0.2, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.48, delay: fly.delay, ease: [0.22, 0.82, 0.2, 1] }}
          onAnimationComplete={() => setFlies((cur) => cur.filter((f) => f.id !== fly.id))}
        >
          <CardView card={fly.card} facedown={fly.facedown || !fly.card} size="sm" />
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
