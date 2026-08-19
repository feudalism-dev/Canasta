import { chairsFromOccupants, SEAT_HINT, type ChairView, type Occupant } from '../core/tableSeating'

function relationClass(chair: ChairView): string {
  if (chair.you) return 'is-you'
  if (chair.relation === 'partner') return 'is-partner'
  if (chair.relation === 'opponent') return 'is-opp'
  return 'is-cpu'
}

function relationLabel(chair: ChairView): string {
  if (chair.you) return 'You'
  if (chair.relation === 'partner') return 'Partner'
  if (chair.relation === 'opponent') return 'Opponent'
  return 'Computer'
}

function ChairCard({ chair }: { chair: ChairView }) {
  const team = chair.team === 0 ? '1+3' : '2+4'
  return (
    <div className={`lobby-chair ${relationClass(chair)}`}>
      <span className="spec-seat-num">
        P{chair.seat + 1} · Team {team}
      </span>
      <strong>{chair.name}</strong>
      <em>{relationLabel(chair)}</em>
      {chair.joined ? <span className="tiny">{chair.ready ? 'Joined · Ready' : 'Joined'}</span> : null}
    </div>
  )
}

export function SeatMap({ occupants, youSeat }: { occupants: Occupant[]; youSeat: number }) {
  const chairs = chairsFromOccupants(occupants, youSeat)
  const you = chairs[youSeat]
  const line = you ? `${you.name} is Player ${youSeat + 1}` : 'Sit a chair to pick your player number.'
  return (
    <div className="lobby-map-wrap">
      <div className="lobby-map" aria-label="Table seating">
        <div className="lobby-north">
          <ChairCard chair={chairs[2]!} />
        </div>
        <div className="lobby-west">
          <ChairCard chair={chairs[3]!} />
        </div>
        <div className="lobby-mid">
          <span>1+3 vs 2+4</span>
        </div>
        <div className="lobby-east">
          <ChairCard chair={chairs[1]!} />
        </div>
        <div className="lobby-south">
          <ChairCard chair={chairs[0]!} />
        </div>
      </div>
      <p className="muted tiny">{line}. {SEAT_HINT}</p>
    </div>
  )
}
