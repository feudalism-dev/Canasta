import type {
  WarfrontAlign,
  WarfrontDifficulty,
  WarfrontTheater,
} from '../core/warfront/types'

type Props = {
  playerCount: number
  onPlayerCount: (n: number) => void
  theater: WarfrontTheater
  onTheater: (t: WarfrontTheater) => void
  align: WarfrontAlign
  onAlign: (a: WarfrontAlign) => void
  difficulty: WarfrontDifficulty
  onDifficulty: (d: WarfrontDifficulty) => void
  onStartSolo: () => void
  disabled?: boolean
  busy?: boolean
}

export function WarfrontSetup({
  playerCount,
  onPlayerCount,
  theater,
  onTheater,
  align,
  onAlign,
  difficulty,
  onDifficulty,
  onStartSolo,
  disabled,
  busy,
}: Props) {
  const lockFields = Boolean(disabled)
  const lockStart = Boolean(disabled || busy)
  return (
    <div className="wf-setup" style={{ display: 'grid', gap: '0.6rem', maxWidth: 380 }}>
      <label>
        Theater{' '}
        <select
          value={theater}
          disabled={lockFields}
          onChange={(e) => onTheater(e.target.value as WarfrontTheater)}
        >
          <option value="land">Land (Depots)</option>
          <option value="sea">Sea (Ports)</option>
        </select>
      </label>
      <label>
        Alignment{' '}
        <select
          value={align}
          disabled={lockFields}
          onChange={(e) => onAlign(e.target.value as WarfrontAlign)}
        >
          <option value="ffa">Free-for-all</option>
          <option value="teams">Teams (2v2)</option>
        </select>
      </label>
      {align === 'ffa' && (
        <label>
          Players (you + bots){' '}
          <select
            value={playerCount}
            disabled={lockFields}
            onChange={(e) => onPlayerCount(Number(e.target.value))}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
      )}
      <label>
        Bot difficulty{' '}
        <select
          value={difficulty}
          disabled={lockFields}
          onChange={(e) => onDifficulty(e.target.value as WarfrontDifficulty)}
        >
          <option value="easy">Easy</option>
          <option value="normal">Normal</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <button type="button" disabled={lockStart} onClick={onStartSolo}>
        Start solo vs bots
      </button>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        Capture depots/ports for PP &amp; VP. Buy units, move adjacent, win at 12 VP. Camera is
        local-only. Use <strong>All games</strong> to leave.
      </p>
    </div>
  )
}
