import { rummyVariantOptions } from '../core/rummy/variants'
import type { RummyVariant } from '../core/rummy/types'

type Props = {
  value: RummyVariant
  disabled?: boolean
  onChange: (v: RummyVariant) => void
}

export function RummyVariantSelect({ value, disabled, onChange }: Props) {
  return (
    <label className="field">
      <span>Game</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as RummyVariant
          const opt = rummyVariantOptions().find((o) => o.value === next)
          if (opt && !opt.ready) return
          onChange(next)
        }}
      >
        {rummyVariantOptions().map((o) => (
          <option key={o.value} value={o.value} disabled={!o.ready}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
