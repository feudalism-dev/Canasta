/** Phase definitions — Classic Phase It list (Masters / Sprint reuse these). */

export type PhasePart =
  | { t: 'set'; size: number }
  | { t: 'run'; length: number }
  | { t: 'color'; count: number }

export type PhaseDef = {
  id: number
  label: string
  parts: PhasePart[]
}

export const CLASSIC_PHASES: PhaseDef[] = [
  { id: 1, label: '2 sets of 3', parts: [{ t: 'set', size: 3 }, { t: 'set', size: 3 }] },
  { id: 2, label: '1 set of 3 + 1 run of 4', parts: [{ t: 'set', size: 3 }, { t: 'run', length: 4 }] },
  { id: 3, label: '1 set of 4 + 1 run of 4', parts: [{ t: 'set', size: 4 }, { t: 'run', length: 4 }] },
  { id: 4, label: '1 run of 7', parts: [{ t: 'run', length: 7 }] },
  { id: 5, label: '1 run of 8', parts: [{ t: 'run', length: 8 }] },
  { id: 6, label: '1 run of 9', parts: [{ t: 'run', length: 9 }] },
  { id: 7, label: '2 sets of 4', parts: [{ t: 'set', size: 4 }, { t: 'set', size: 4 }] },
  { id: 8, label: '7 cards of one color', parts: [{ t: 'color', count: 7 }] },
  { id: 9, label: '1 set of 5 + 1 set of 2', parts: [{ t: 'set', size: 5 }, { t: 'set', size: 2 }] },
  { id: 10, label: '1 set of 5 + 1 set of 3', parts: [{ t: 'set', size: 5 }, { t: 'set', size: 3 }] },
]

/** Sprint = first five classic phases only. */
export const SPRINT_PHASE_COUNT = 5

export function phaseDef(phaseIndex: number): PhaseDef {
  return CLASSIC_PHASES[Math.min(CLASSIC_PHASES.length - 1, Math.max(0, phaseIndex))]!
}

export function phaseLabel(phaseIndex: number): string {
  if (phaseIndex < 0) return 'Choose a phase'
  if (phaseIndex >= CLASSIC_PHASES.length) return 'Complete'
  return `Phase ${phaseIndex + 1}: ${phaseDef(phaseIndex).label}`
}

export function initialRemaining(variant: 'classic' | 'masters' | 'sprint'): number[] {
  const n = variant === 'sprint' ? SPRINT_PHASE_COUNT : CLASSIC_PHASES.length
  return Array.from({ length: n }, (_, i) => i)
}

export function phasesToWin(variant: 'classic' | 'masters' | 'sprint'): number {
  return variant === 'sprint' ? SPRINT_PHASE_COUNT : CLASSIC_PHASES.length
}
