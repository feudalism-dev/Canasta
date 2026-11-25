import type { WarfrontPublicBoard } from '../core/warfront/publicBoard'
import '../styles/warfront.css'

type Props = {
  board: WarfrontPublicBoard
}

const SIDE_COLORS = ['#2a9d8f', '#e9c46a', '#9b5de5', '#f4a261']

export function WarfrontSpectator({ board }: Props) {
  if (!board.live && board.phase === 'idle') {
    return (
      <div className="wf-spec idle">
        <p>Warfront — awaiting match</p>
      </div>
    )
  }

  const colorForSeat = (seat: number) => {
    if (seat < 0) return 'rgba(160,160,140,0.3)'
    const idx = board.players.findIndex((p) => p.seat === seat)
    return SIDE_COLORS[(idx >= 0 ? idx : seat) % SIDE_COLORS.length]!
  }

  return (
    <div className="wf-spec">
      <header className="wf-spec-head">
        <strong>Warfront</strong>
        <span>
          {board.theater === 'sea' ? 'Sea' : 'Land'} · {board.align === 'teams' ? '2v2' : 'FFA'} · R
          {board.round}
        </span>
        <span>{board.turnName || '—'} · {board.phase}</span>
      </header>
      <p className="wf-spec-msg">{board.lastMessage}</p>
      <div className="wf-spec-map">
        <svg viewBox="0 0 1 1" className="wf-spec-svg">
          {board.layout.map((p, i) => {
            const z = board.zones[i]
            if (!z) return null
            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={0.035}
                  fill={colorForSeat(z.ownerSeat)}
                  stroke={z.facility ? '#d4b56a' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={z.facility ? 0.012 : 0.004}
                />
                {z.stackN > 0 ? (
                  <text
                    x={p.x}
                    y={p.y + 0.01}
                    textAnchor="middle"
                    fontSize="0.04"
                    fill="#1a1510"
                  >
                    {z.stackN}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="wf-spec-scores">
        {board.players.map((p) => (
          <li key={p.id}>
            {p.name}: {p.vp} VP
          </li>
        ))}
      </ul>
    </div>
  )
}
