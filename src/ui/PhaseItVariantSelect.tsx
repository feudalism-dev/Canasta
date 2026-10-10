import { phaseItVariantOptions } from '../core/phaseit/variants'
import type { PhaseItVariant } from '../core/phaseit/types'

type Props = {
  value: PhaseItVariant
  disabled?: boolean
  onChange: (v: PhaseItVariant) => void
}

export function PhaseItVariantSelect({ value, disabled, onChange }: Props) {
  return (
    <label className="field">
      <span>Game</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as PhaseItVariant
          const opt = phaseItVariantOptions().find((o) => o.value === next)
          if (opt && !opt.ready) return
          onChange(next)
        }}
      >
        {phaseItVariantOptions().map((o) => (
          <option key={o.value} value={o.value} disabled={!o.ready}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
