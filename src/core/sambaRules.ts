import { isRedThree } from './cards'
import { canastaKind, isSequenceMeld, meldIsCanasta, meldIsWildBook, teamCanastaCounts } from './melds'
import { meldIsSamba } from './sequences'
import type { GoingOutRule, Meld, VariantConfig } from './types'

export type MajorMeldCounts = {
  sambas: number
  canastas: number
  bolivias: number
}

/** Completed seven-card melds for go-out checks. */
export function teamMajorMeldCounts(melds: Meld[], size: number): MajorMeldCounts {
  let sambas = 0
  let canastas = 0
  let bolivias = 0
  for (const m of melds) {
    if (meldIsSamba(m, size)) sambas++
    else if (meldIsWildBook(m) && m.cards.length >= size) bolivias++
    else if (!isSequenceMeld(m) && meldIsCanasta(m, size)) canastas++
  }
  return { sambas, canastas, bolivias }
}

export function sambaGoOutMet(counts: MajorMeldCounts): boolean {
  if (counts.sambas >= 2) return true
  if (counts.canastas >= 2) return true
  return counts.sambas >= 1 && counts.canastas >= 1
}

export function boliviaGoOutMet(counts: MajorMeldCounts): boolean {
  const majors = counts.sambas + counts.canastas + counts.bolivias
  return majors >= 2 && counts.sambas >= 1
}

export function teamMeetsGoOutRule(melds: Meld[], config: VariantConfig): boolean {
  const size = config.canastaSize
  const rule = config.goingOutRule
  if (rule === 'canasta') {
    const c = teamCanastaCounts(melds, size)
    return c.clean + c.dirty + c.wild >= 1
  }
  if (rule === 'handAndFoot') {
    const c = teamCanastaCounts(melds, size)
    return c.clean >= config.house.goingOutClean && c.dirty + c.wild >= config.house.goingOutDirty
  }
  const majors = teamMajorMeldCounts(melds, size)
  if (rule === 'samba') return sambaGoOutMet(majors)
  return boliviaGoOutMet(majors)
}

/** Cards to draw from stock this turn (Samba: one card when only one remains). */
export function stockDrawCount(config: VariantConfig, stockLeft: number): number {
  const want = config.stockDraw
  if (stockLeft <= 0) return 0
  if (want > 1 && stockLeft < want) return stockLeft
  return want
}

export function meldBonusPoints(meld: Meld, config: VariantConfig): number {
  const size = config.canastaSize
  if (meldIsSamba(meld, size)) return 1500
  if (config.goingOutRule === 'bolivia' && meldIsWildBook(meld) && meld.cards.length >= size) return 2500
  const kind = canastaKind(meld, size)
  if (kind === 'natural') return 500
  if (kind === 'mixed') return 300
  if (kind === 'wild') return 1500
  return 0
}

export function goingOutBonus(config: VariantConfig): number {
  if (config.goingOutRule === 'canasta') return 100
  if (config.goingOutRule === 'handAndFoot') return 100
  return 200
}

export function redThreeInHandPenalty(config: VariantConfig, count: number): number {
  if (count <= 0) return 0
  if (config.redThreeMode === 'samba') return 750
  return 0
}

export function scoreSambaRedThrees(
  laid: number,
  goOutMet: boolean,
  playerCount: number,
): number {
  if (laid === 0) return 0
  if (!goOutMet) return -100 * laid
  if (laid >= 6 && playerCount >= 4) return 1000
  return 100 * laid
}

export function isRedThreeMeld(cards: import('./cards').Card[]): boolean {
  return cards.length === 1 && isRedThree(cards[0]!)
}
