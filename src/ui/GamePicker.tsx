import { GAME_FAMILIES, familyAdSrc, familyLabel, type GameFamily } from '../core/family'

type Props = {
  owned: Set<GameFamily>
  busy?: boolean
  onPick: (family: GameFamily) => void
}

export function GamePicker({ owned, busy = false, onPick }: Props) {
  return (
    <div className="game-picker" role="list">
      {GAME_FAMILIES.map((fam) => {
        const unlocked = owned.has(fam)
        const label = familyLabel(fam)
        return (
          <button
            key={fam}
            type="button"
            role="listitem"
            className={`game-picker-card${unlocked ? '' : ' is-locked'}`}
            disabled={busy || !unlocked}
            aria-label={unlocked ? `Play ${label}` : `${label} — not registered`}
            title={unlocked ? label : `${label} — not registered on this account`}
            onClick={() => {
              if (unlocked) onPick(fam)
            }}
          >
            <img src={familyAdSrc(fam)} alt="" draggable={false} />
            <span className="game-picker-label">{label}</span>
            {!unlocked ? <span className="game-picker-lock">Not registered</span> : null}
          </button>
        )
      })}
    </div>
  )
}
