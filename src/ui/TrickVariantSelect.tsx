import { trickVariantOptions } from '../core/trick/variants'
import type { TrickVariant } from '../core/trick/types'

type Props = {
  value: TrickVariant
  disabled?: boolean
  onChange: (v: TrickVariant) => void
}

export function TrickVariantSelect({ value, disabled, onChange }: Props) {
  return (
    <label className="field">
      <span>Game</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as TrickVariant
          const opt = trickVariantOptions().find((o) => o.value === next)
          if (opt && !opt.ready) return
          onChange(next)
        }}
      >
        {trickVariantOptions().map((o) => (
          <option key={o.value} value={o.value} disabled={!o.ready}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
