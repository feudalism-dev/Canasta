import { yotsyVariantOptions } from '../core/yotsy/variants'
import type { YotsyVariant } from '../core/yotsy/types'

type Props = {
  value: YotsyVariant
  disabled?: boolean
  onChange: (v: YotsyVariant) => void
}

export function YotsyVariantSelect({ value, disabled, onChange }: Props) {
  return (
    <label className="field">
      <span>Game</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as YotsyVariant
          const opt = yotsyVariantOptions().find((o) => o.value === next)
          if (opt && !opt.ready) return
          onChange(next)
        }}
      >
        {yotsyVariantOptions().map((o) => (
          <option key={o.value} value={o.value} disabled={!o.ready}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
