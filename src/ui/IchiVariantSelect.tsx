import { ichiVariantOptions } from '../core/ichi/variants'
import type { IchiVariant } from '../core/ichi/types'

type Props = {
  value: IchiVariant
  disabled?: boolean
  onChange: (v: IchiVariant) => void
}

export function IchiVariantSelect({ value, disabled, onChange }: Props) {
  return (
    <label className="field">
      <span>Game</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as IchiVariant
          const opt = ichiVariantOptions().find((o) => o.value === next)
          if (opt && !opt.ready) return
          onChange(next)
        }}
      >
        {ichiVariantOptions().map((o) => (
          <option key={o.value} value={o.value} disabled={!o.ready}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
