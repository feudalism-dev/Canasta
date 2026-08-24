import type { MatchState } from '../core/types'

type Props = {
  state: MatchState
  localIndex: number
}

function shortName(displayName: string, isYou: boolean): string {
  if (isYou) return 'You'
  const trimmed = displayName.trim()
  if (trimmed.length <= 10) return trimmed
  return `${trimmed.slice(0, 9)}…`
}

export function PlayerHandCounts({ state, localIndex }: Props) {
  const myTeam = state.players[localIndex]!.team
  const showFoot = state.config.footSize > 0

  return (
    <div className="hand-count-strip" aria-label="Cards in hand for each player">
      {state.players.map((p, i) => {
        const isYou = i === localIndex
        const isTurn = state.currentPlayer === i
        const isPartner = !isYou && p.team === myTeam
        return (
          <div
            key={p.seat}
            className={`hand-count-chip ${isTurn ? 'is-turn' : ''} ${isYou ? 'is-you' : ''} ${isPartner ? 'is-partner' : ''}`}
          >
            <span className="hand-count-label">
              P{p.seat + 1} · {shortName(p.displayName, isYou)}
            </span>
            <strong className="hand-count-num" aria-label={`${p.hand.length} cards in hand`}>
              {p.hand.length}
            </strong>
            <span className="hand-count-sub">
              {showFoot ? (p.footPickedUp ? 'Foot open' : 'Foot sealed') : 'in hand'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
