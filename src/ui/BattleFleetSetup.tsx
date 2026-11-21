import type { BattleFleetDifficulty, BattleFleetMode } from '../core/battlefleet/types'

type Props = {
  playerCount: number
  onPlayerCount: (n: number) => void
  mode: BattleFleetMode
  onMode: (m: BattleFleetMode) => void
  difficulty: BattleFleetDifficulty
  onDifficulty: (d: BattleFleetDifficulty) => void
  onStartSolo: () => void
  disabled?: boolean
  busy?: boolean
}

export function BattleFleetSetup({
  playerCount,
  onPlayerCount,
  mode,
  onMode,
  difficulty,
  onDifficulty,
  onStartSolo,
  disabled,
  busy,
}: Props) {
  const lockFields = Boolean(disabled)
  const lockStart = Boolean(disabled || busy)
  return (
    <div className="bf-setup" style={{ display: 'grid', gap: '0.6rem', maxWidth: 360 }}>
      <label>
        Mode{' '}
        <select
          value={mode}
          disabled={lockFields}
          onChange={(e) => onMode(e.target.value as BattleFleetMode)}
        >
          <option value="ffa">Free-for-all</option>
          <option value="teams">Teams (2v2)</option>
        </select>
      </label>
      {mode === 'ffa' && (
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
          onChange={(e) => onDifficulty(e.target.value as BattleFleetDifficulty)}
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
        Solo vs bots here, or Create room for multiplayer (empty seats = bots). Teams: opposite
        seats are partners sharing one fleet. Use <strong>All games</strong> to leave.
      </p>
    </div>
  )
}
