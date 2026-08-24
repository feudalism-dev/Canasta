import type { HouseRules, Variant } from './types'

export type { HouseRules }

/** Pagat Hand & Foot — fixed ruleset (not editable). */
export const PAGAT_HOUSE: HouseRules = {
  goingOutClean: 1,
  goingOutDirty: 1,
  wildBooksAllowed: true,
  partnerConsent: true,
  addToClosedBooks: false,
  requireDiscardToGoOut: true,
  requireNaturalPairToTakePile: true,
  autoplayRedThreesOnDraw: true,
  autoplayRedThreesOnFootOpen: true,
  replaceRedThreesFromHand: true,
  replaceRedThreesOnFootOpen: true,
  redThreeDiscardFreezes: true,
  redThreeScoreEnabled: true,
  redThreeScorePoints: 100,
  redThreeHandEndPenalty: true,
  redThreeHandEndPenaltyPoints: 100,
  redThreeSealedFootPenalty: true,
  redThreeSealedFootPenaltyPoints: 100,
  blackThreeEndPenaltyPoints: 5,
  takeDiscardTopSeven: false,
}

/**
 * OOTB defaults for House Rules H&F / LSD when nothing is saved yet.
 * Tunable later — currently mirrors Pagat.
 */
export const DEFAULT_HOUSE: HouseRules = { ...PAGAT_HOUSE }

export function isHandAndFoot(variant: Variant): boolean {
  return variant === 'handAndFoot' || variant === 'handAndFootHouse'
}

export function isPagatHandAndFoot(variant: Variant): boolean {
  return variant === 'handAndFoot'
}

export function isHouseRulesHandAndFoot(variant: Variant): boolean {
  return variant === 'handAndFootHouse'
}

export function isSambaFamily(variant: Variant): boolean {
  return variant === 'samba' || variant === 'bolivia'
}

export function isSamba(variant: Variant): boolean {
  return variant === 'samba'
}

export function isBolivia(variant: Variant): boolean {
  return variant === 'bolivia'
}

/** Samba and Bolivia ship as beta variants — playable but rules/UI may change. */
export function isBetaVariant(variant: Variant): boolean {
  return isSambaFamily(variant)
}

export function variantLabel(variant: Variant): string {
  if (variant === 'canasta') return 'Classic Canasta'
  if (variant === 'handAndFoot') return 'Pagat Hand & Foot'
  if (variant === 'handAndFootHouse') return 'House Rules Hand & Foot'
  if (variant === 'samba') return 'Samba'
  return 'Bolivia'
}

export function normalizeHouse(partial?: Partial<HouseRules> | null): HouseRules {
  return { ...DEFAULT_HOUSE, ...(partial || {}) }
}

/** Resolve house for a match: Pagat ignores overrides. */
export function houseForVariant(variant: Variant, house?: Partial<HouseRules> | null): HouseRules {
  if (variant === 'canasta') {
    return {
      ...DEFAULT_HOUSE,
      partnerConsent: false,
      goingOutClean: 0,
      goingOutDirty: 0,
      wildBooksAllowed: false,
    }
  }
  if (variant === 'samba') {
    return {
      ...DEFAULT_HOUSE,
      partnerConsent: true,
      goingOutClean: 0,
      goingOutDirty: 0,
      wildBooksAllowed: false,
      // QoL: lay + replace like Classic (Pagat scoring still applies to laid reds).
      autoplayRedThreesOnDraw: true,
      autoplayRedThreesOnFootOpen: true,
      replaceRedThreesFromHand: true,
      replaceRedThreesOnFootOpen: true,
      requireDiscardToGoOut: true,
      requireNaturalPairToTakePile: true,
    }
  }
  if (variant === 'bolivia') {
    return {
      ...DEFAULT_HOUSE,
      partnerConsent: true,
      goingOutClean: 0,
      goingOutDirty: 0,
      wildBooksAllowed: true,
      autoplayRedThreesOnDraw: true,
      autoplayRedThreesOnFootOpen: true,
      replaceRedThreesFromHand: true,
      replaceRedThreesOnFootOpen: true,
      requireDiscardToGoOut: true,
      requireNaturalPairToTakePile: true,
    }
  }
  if (isPagatHandAndFoot(variant)) return { ...PAGAT_HOUSE }
  return normalizeHouse(house)
}

const HOUSE_COMPACT_VER = 'v1'

/** Compact pipe form for LSD / JSONP (booleans as 0/1). */
export function encodeHouseCompact(house: HouseRules): string {
  const h = normalizeHouse(house)
  const b = (v: boolean) => (v ? 1 : 0)
  return [
    HOUSE_COMPACT_VER,
    h.goingOutClean,
    h.goingOutDirty,
    b(h.wildBooksAllowed),
    b(h.partnerConsent),
    b(h.addToClosedBooks),
    b(h.requireDiscardToGoOut),
    b(h.requireNaturalPairToTakePile),
    b(h.autoplayRedThreesOnDraw),
    b(h.autoplayRedThreesOnFootOpen),
    b(h.replaceRedThreesFromHand),
    b(h.replaceRedThreesOnFootOpen),
    b(h.redThreeDiscardFreezes),
    b(h.redThreeScoreEnabled),
    h.redThreeScorePoints,
    b(h.redThreeHandEndPenalty),
    h.redThreeHandEndPenaltyPoints,
    b(h.redThreeSealedFootPenalty),
    h.redThreeSealedFootPenaltyPoints,
    h.blackThreeEndPenaltyPoints,
    b(h.takeDiscardTopSeven),
  ].join('|')
}

export function decodeHouseCompact(raw: string | null | undefined): HouseRules | null {
  if (!raw || typeof raw !== 'string') return null
  const p = raw.split('|')
  if (p[0] !== HOUSE_COMPACT_VER || p.length < 21) return null
  const n = (i: number, fallback: number) => {
    const v = Number(p[i])
    return Number.isFinite(v) ? v : fallback
  }
  const tf = (i: number, fallback: boolean) => {
    if (p[i] === undefined || p[i] === '') return fallback
    return p[i] === '1' || p[i] === 'true'
  }
  const d = DEFAULT_HOUSE
  return normalizeHouse({
    goingOutClean: n(1, d.goingOutClean),
    goingOutDirty: n(2, d.goingOutDirty),
    wildBooksAllowed: tf(3, d.wildBooksAllowed),
    partnerConsent: tf(4, d.partnerConsent),
    addToClosedBooks: tf(5, d.addToClosedBooks),
    requireDiscardToGoOut: tf(6, d.requireDiscardToGoOut),
    requireNaturalPairToTakePile: tf(7, d.requireNaturalPairToTakePile),
    autoplayRedThreesOnDraw: tf(8, d.autoplayRedThreesOnDraw),
    autoplayRedThreesOnFootOpen: tf(9, d.autoplayRedThreesOnFootOpen),
    replaceRedThreesFromHand: tf(10, d.replaceRedThreesFromHand),
    replaceRedThreesOnFootOpen: tf(11, d.replaceRedThreesOnFootOpen),
    redThreeDiscardFreezes: tf(12, d.redThreeDiscardFreezes),
    redThreeScoreEnabled: tf(13, d.redThreeScoreEnabled),
    redThreeScorePoints: n(14, d.redThreeScorePoints),
    redThreeHandEndPenalty: tf(15, d.redThreeHandEndPenalty),
    redThreeHandEndPenaltyPoints: n(16, d.redThreeHandEndPenaltyPoints),
    redThreeSealedFootPenalty: tf(17, d.redThreeSealedFootPenalty),
    redThreeSealedFootPenaltyPoints: n(18, d.redThreeSealedFootPenaltyPoints),
    blackThreeEndPenaltyPoints: n(19, d.blackThreeEndPenaltyPoints),
    takeDiscardTopSeven: tf(20, d.takeDiscardTopSeven),
  })
}

/** Short lines for lobby / join preview. */
export function houseRulesSummary(house: HouseRules, variant: Variant): string[] {
  if (variant === 'canasta') {
    return ['Classic Canasta (fixed rules — no house toggles).']
  }
  if (isSamba(variant)) {
    return [
      'Samba (beta): sequences + canastas, draw two, play to 10,000.',
      'Report bugs — rules and scoring may change while beta.',
    ]
  }
  if (isBolivia(variant)) {
    return [
      'Bolivia (beta): Samba plus wild Bolivia books, play to 15,000.',
      'Report bugs — rules and scoring may change while beta.',
    ]
  }
  if (isPagatHandAndFoot(variant)) {
    return [
      'Pagat Hand & Foot (fixed): full discard pile, red 3s auto-lay + replace, −100 in sealed Foot.',
    ]
  }
  const h = normalizeHouse(house)
  const lines: string[] = []
  lines.push(h.takeDiscardTopSeven ? 'Discard pickup: top 7 cards' : 'Discard pickup: entire pile')
  lines.push(
    h.requireNaturalPairToTakePile
      ? 'Pile pickup needs a natural pair'
      : 'Pile may be taken onto an existing meld (when unfrozen)',
  )
  lines.push(`Books to go out: ${h.goingOutClean} clean + ${h.goingOutDirty} dirty`)
  lines.push(h.wildBooksAllowed ? 'Wild books allowed (+1500)' : 'Wild books forbidden')
  lines.push(h.addToClosedBooks ? 'May add to closed books' : 'No adds to closed books')
  lines.push(h.requireDiscardToGoOut ? 'Must discard to go out' : 'May meld out with no discard')
  lines.push(h.partnerConsent ? 'Partner must consent to go out' : 'No partner consent needed')
  lines.push(
    h.autoplayRedThreesOnDraw ? 'Auto-lay red 3s on draw/deal' : 'Hold red 3s on draw (may discard)',
  )
  lines.push(
    h.autoplayRedThreesOnFootOpen ? 'Auto-lay red 3s when opening Foot' : 'Keep red 3s when opening Foot',
  )
  lines.push(h.replaceRedThreesFromHand ? 'Replace red 3s from hand/stock/pile' : 'No replace from hand')
  lines.push(h.replaceRedThreesOnFootOpen ? 'Replace red 3s when Foot opens' : 'No replace on Foot open')
  lines.push(h.redThreeDiscardFreezes ? 'Discarding a red 3 freezes the pile' : 'Red 3 discard does not freeze')
  if (h.redThreeScoreEnabled) lines.push(`Laid red 3s score +${h.redThreeScorePoints} each`)
  else lines.push('Laid red 3s score 0')
  if (h.redThreeHandEndPenalty) lines.push(`Red 3s in Hand at end: −${h.redThreeHandEndPenaltyPoints}`)
  else lines.push('Red 3s in Hand at end: no penalty')
  if (h.redThreeSealedFootPenalty) {
    lines.push(`Red 3s in sealed Foot at end: −${h.redThreeSealedFootPenaltyPoints}`)
  } else {
    lines.push('Red 3s in sealed Foot at end: no penalty')
  }
  lines.push(`Black 3s left in hand/Foot: −${h.blackThreeEndPenaltyPoints} each`)
  return lines
}
