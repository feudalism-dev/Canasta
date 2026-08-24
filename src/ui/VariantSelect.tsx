import type { Variant } from '../core/types'
import { variantOptions } from '../core/variants'

type Props = {
  value: Variant
  onChange: (v: Variant) => void
  disabled?: boolean
  id?: string
}

export function VariantSelect({ value, onChange, disabled, id }: Props) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Variant)}>
      {variantOptions().map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
