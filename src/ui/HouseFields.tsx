import type { HouseRules } from '../core/types'
import { houseRulesSummary } from '../core/houseRules'
import type { Variant } from '../core/types'

type Props = {
  house: HouseRules
  onChange: (house: HouseRules) => void
  /** When false, fields are read-only (Pagat or guest preview). */
  editable?: boolean
}

function Num({
  label,
  value,
  onChange,
  disabled,
  min = 0,
  max = 500,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  min?: number
  max?: number
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}

export function HandAndFootHouseFields({ house, onChange, editable = true }: Props) {
  const set = (patch: Partial<HouseRules>) => onChange({ ...house, ...patch })
  const dis = !editable
  return (
    <div className="house-fields">
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.requireNaturalPairToTakePile}
          onChange={(e) => set({ requireNaturalPairToTakePile: e.target.checked })}
        />
        Require natural pair to pick up the discard pile
      </label>
      <label>
        Discard pickup
        <select
          disabled={dis}
          value={house.takeDiscardTopSeven ? '7' : 'all'}
          onChange={(e) => set({ takeDiscardTopSeven: e.target.value === '7' })}
        >
          <option value="all">Entire pile</option>
          <option value="7">Top 7 only</option>
        </select>
      </label>
      <label>
        Books to go out
        <select
          disabled={dis}
          value={`${house.goingOutClean}-${house.goingOutDirty}`}
          onChange={(e) => {
            const v = e.target.value
            if (v === '2-2') set({ goingOutClean: 2, goingOutDirty: 2 })
            else set({ goingOutClean: 1, goingOutDirty: 1 })
          }}
        >
          <option value="1-1">1 clean + 1 dirty</option>
          <option value="2-2">2 clean + 2 dirty</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.wildBooksAllowed}
          onChange={(e) => set({ wildBooksAllowed: e.target.checked })}
        />
        Allow wild books (+1500)
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.addToClosedBooks}
          onChange={(e) => set({ addToClosedBooks: e.target.checked })}
        />
        Allow adding to closed books
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.requireDiscardToGoOut}
          onChange={(e) => set({ requireDiscardToGoOut: e.target.checked })}
        />
        Require a discard to go out
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.partnerConsent}
          onChange={(e) => set({ partnerConsent: e.target.checked })}
        />
        Partner must consent to go out
      </label>

      <p className="muted house-section">Red threes</p>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.autoplayRedThreesOnDraw}
          onChange={(e) => set({ autoplayRedThreesOnDraw: e.target.checked })}
        />
        Auto-lay red 3s on draw / deal / pile
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.autoplayRedThreesOnFootOpen}
          onChange={(e) => set({ autoplayRedThreesOnFootOpen: e.target.checked })}
        />
        Auto-lay red 3s when opening Foot
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.replaceRedThreesFromHand}
          onChange={(e) => set({ replaceRedThreesFromHand: e.target.checked })}
        />
        Replace red 3s when laid from Hand
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.replaceRedThreesOnFootOpen}
          onChange={(e) => set({ replaceRedThreesOnFootOpen: e.target.checked })}
        />
        Replace red 3s when Foot opens
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.redThreeDiscardFreezes}
          onChange={(e) => set({ redThreeDiscardFreezes: e.target.checked })}
        />
        Discarding a red 3 freezes the pile
      </label>
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.redThreeScoreEnabled}
          onChange={(e) => set({ redThreeScoreEnabled: e.target.checked })}
        />
        Laid red 3s score points
      </label>
      {house.redThreeScoreEnabled ? (
        <Num
          label="Points per laid red 3"
          value={house.redThreeScorePoints}
          disabled={dis}
          onChange={(n) => set({ redThreeScorePoints: n })}
        />
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.redThreeHandEndPenalty}
          onChange={(e) => set({ redThreeHandEndPenalty: e.target.checked })}
        />
        Penalize red 3s left in Hand at end
      </label>
      {house.redThreeHandEndPenalty ? (
        <Num
          label="Hand red 3 penalty"
          value={house.redThreeHandEndPenaltyPoints}
          disabled={dis}
          onChange={(n) => set({ redThreeHandEndPenaltyPoints: n })}
        />
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          disabled={dis}
          checked={house.redThreeSealedFootPenalty}
          onChange={(e) => set({ redThreeSealedFootPenalty: e.target.checked })}
        />
        Penalize red 3s left in sealed Foot at end
      </label>
      {house.redThreeSealedFootPenalty ? (
        <Num
          label="Sealed Foot red 3 penalty"
          value={house.redThreeSealedFootPenaltyPoints}
          disabled={dis}
          onChange={(n) => set({ redThreeSealedFootPenaltyPoints: n })}
        />
      ) : null}
      <Num
        label="Black 3s left in Hand/Foot (each)"
        value={house.blackThreeEndPenaltyPoints}
        disabled={dis}
        onChange={(n) => set({ blackThreeEndPenaltyPoints: n })}
      />
    </div>
  )
}

export function HouseRulesPreview({ house, variant }: { house: HouseRules; variant: Variant }) {
  const lines = houseRulesSummary(house, variant)
  return (
    <div className="house-preview">
      <p className="brand-kicker">House rules</p>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
