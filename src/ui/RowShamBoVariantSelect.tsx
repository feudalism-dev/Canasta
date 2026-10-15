import { MATCH_TARGETS, rowShamBoVariantOptions } from '../core/rowshambo/variants'
import type { RowShamBoVariant } from '../core/rowshambo/types'

type Props = {
  value: RowShamBoVariant
  playTo: number
  disabled?: boolean
  onChange: (v: RowShamBoVariant) => void
  onPlayTo: (n: number) => void
}

export function RowShamBoVariantSelect({ value, playTo, disabled, onChange, onPlayTo }: Props) {
  return (
    <>
      <label className="field">
        <span>Game</span>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value as RowShamBoVariant
            const opt = rowShamBoVariantOptions().find((o) => o.value === next)
            if (opt && !opt.ready) return
            onChange(next)
          }}
        >
          {rowShamBoVariantOptions().map((o) => (
            <option key={o.value} value={o.value} disabled={!o.ready}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Match to</span>
        <select
          value={playTo}
          disabled={disabled}
          onChange={(e) => onPlayTo(Number(e.target.value))}
        >
          {MATCH_TARGETS.map((n) => (
            <option key={n} value={n}>
              {n} points
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
