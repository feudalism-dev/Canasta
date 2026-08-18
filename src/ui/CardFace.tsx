import { suitGlyph, type Card, type Rank } from '../core/cards'

type PipSpot = { x: number; y: number; flip?: boolean }

/** Standard French-suited pip posts, in percent of the face. */
const PIP_LAYOUT: Partial<Record<Rank, PipSpot[]>> = {
  A: [{ x: 50, y: 50 }],
  '2': [
    { x: 50, y: 16 },
    { x: 50, y: 84, flip: true },
  ],
  '3': [
    { x: 50, y: 16 },
    { x: 50, y: 50 },
    { x: 50, y: 84, flip: true },
  ],
  '4': [
    { x: 24, y: 16 },
    { x: 76, y: 16 },
    { x: 24, y: 84, flip: true },
    { x: 76, y: 84, flip: true },
  ],
  '5': [
    { x: 24, y: 16 },
    { x: 76, y: 16 },
    { x: 50, y: 50 },
    { x: 24, y: 84, flip: true },
    { x: 76, y: 84, flip: true },
  ],
  '6': [
    { x: 24, y: 16 },
    { x: 76, y: 16 },
    { x: 24, y: 50 },
    { x: 76, y: 50 },
    { x: 24, y: 84, flip: true },
    { x: 76, y: 84, flip: true },
  ],
  '7': [
    { x: 24, y: 16 },
    { x: 76, y: 16 },
    { x: 50, y: 33 },
    { x: 24, y: 50 },
    { x: 76, y: 50 },
    { x: 24, y: 84, flip: true },
    { x: 76, y: 84, flip: true },
  ],
  '8': [
    { x: 24, y: 16 },
    { x: 76, y: 16 },
    { x: 50, y: 33 },
    { x: 24, y: 50 },
    { x: 76, y: 50 },
    { x: 50, y: 67, flip: true },
    { x: 24, y: 84, flip: true },
    { x: 76, y: 84, flip: true },
  ],
  '9': [
    { x: 24, y: 14 },
    { x: 76, y: 14 },
    { x: 24, y: 38 },
    { x: 76, y: 38 },
    { x: 50, y: 50 },
    { x: 24, y: 62, flip: true },
    { x: 76, y: 62, flip: true },
    { x: 24, y: 86, flip: true },
    { x: 76, y: 86, flip: true },
  ],
  '10': [
    { x: 24, y: 14 },
    { x: 76, y: 14 },
    { x: 50, y: 26 },
    { x: 24, y: 38 },
    { x: 76, y: 38 },
    { x: 24, y: 62, flip: true },
    { x: 76, y: 62, flip: true },
    { x: 50, y: 74, flip: true },
    { x: 24, y: 86, flip: true },
    { x: 76, y: 86, flip: true },
  ],
}

function CourtMark({ rank, pip }: { rank: 'J' | 'Q' | 'K'; pip: string }) {
  return (
    <span className={`cn-court is-${rank}`} aria-hidden>
      <svg viewBox="0 0 80 110" className="cn-court-svg">
        <rect x="4" y="4" width="72" height="102" rx="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <rect x="10" y="10" width="60" height="90" rx="4" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
        {rank === 'K' ? (
          <path d="M18 38 L28 22 L40 34 L52 22 L62 38 Z" fill="currentColor" opacity="0.92" />
        ) : rank === 'Q' ? (
          <path d="M40 20 L46 34 L62 34 L50 44 L54 60 L40 50 L26 60 L30 44 L18 34 L34 34 Z" fill="currentColor" opacity="0.92" />
        ) : (
          <path d="M24 36 L40 20 L56 36 L52 40 L40 30 L28 40 Z" fill="currentColor" opacity="0.92" />
        )}
        <text x="40" y="78" textAnchor="middle" fontSize="36" fontFamily="serif" fontWeight="700" fill="currentColor">
          {rank}
        </text>
        <text x="40" y="96" textAnchor="middle" fontSize="14" fill="currentColor">
          {pip}
        </text>
      </svg>
    </span>
  )
}

function JokerMark({ red }: { red: boolean }) {
  return (
    <span className={`cn-court is-joker ${red ? 'is-red-joker' : ''}`} aria-hidden>
      <svg viewBox="0 0 80 110" className="cn-court-svg">
        <rect x="4" y="4" width="72" height="102" rx="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="40" cy="36" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M26 36 L14 22 M40 22 L40 8 M54 36 L66 22" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="14" cy="22" r="3" fill="currentColor" />
        <circle cx="40" cy="8" r="3" fill="currentColor" />
        <circle cx="66" cy="22" r="3" fill="currentColor" />
        <text x="40" y="72" textAnchor="middle" fontSize="11" fontFamily="serif" letterSpacing="1.5" fill="currentColor">
          JOKER
        </text>
        <text x="40" y="94" textAnchor="middle" fontSize="18" fill="currentColor">
          ★
        </text>
      </svg>
    </span>
  )
}

export function CardFace({ card }: { card: Card }) {
  const pip = card.rank === 'JOKER' ? '★' : suitGlyph(card.suit)
  const label = card.rank === 'JOKER' ? '★' : card.rank
  const redJoker = card.rank === 'JOKER' && card.id.endsWith('-1')
  const spots = PIP_LAYOUT[card.rank]
  const ace = card.rank === 'A'

  return (
    <span className="cn-card-face">
      <span className="cn-card-corner tl">
        <em>{label}</em>
        <i>{pip}</i>
      </span>
      {card.rank === 'JOKER' ? (
        <JokerMark red={redJoker} />
      ) : card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' ? (
        <CourtMark rank={card.rank} pip={pip} />
      ) : (
        <span className={`cn-pips ${ace ? 'is-ace' : ''}`}>
          {(spots ?? [{ x: 50, y: 50 }]).map((spot, i) => (
            <i
              key={`${spot.x}-${spot.y}-${i}`}
              className={spot.flip ? 'is-flip' : undefined}
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              {pip}
            </i>
          ))}
        </span>
      )}
      <span className="cn-card-corner br">
        <em>{label}</em>
        <i>{pip}</i>
      </span>
    </span>
  )
}
