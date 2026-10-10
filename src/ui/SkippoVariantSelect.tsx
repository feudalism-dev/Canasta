import { skippoVariantOptions } from '../core/skippo/variants'
import type { SkippoVariant } from '../core/skippo/types'

type Props = {
  value: SkippoVariant
  disabled?: boolean
  onChange: (v: SkippoVariant) => void
}

export function SkippoVariantSelect({ value, disabled, onChange }: Props) {
  return (
    <label className="field">
      <span>Game</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as SkippoVariant
          const opt = skippoVariantOptions().find((o) => o.value === next)
          if (opt && !opt.ready) return
          onChange(next)
        }}
      >
        {skippoVariantOptions().map((o) => (
          <option key={o.value} value={o.value} disabled={!o.ready}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
