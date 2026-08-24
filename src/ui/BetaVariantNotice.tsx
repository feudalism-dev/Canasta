import { BETA_VARIANT_NOTICE } from '../core/variants'

type Props = {
  /** Shorter copy for tight HUD chrome. */
  compact?: boolean
  className?: string
}

export function BetaVariantNotice({ compact, className }: Props) {
  const text = compact ? 'Beta — report bugs.' : BETA_VARIANT_NOTICE
  return (
    <p className={`beta-notice ${className ?? ''}`.trim()} role="status">
      <span className="beta-badge">Beta</span>
      {text}
    </p>
  )
}
