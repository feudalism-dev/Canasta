import type { AiDifficulty } from '../ai/heuristic'
import type { HouseRules, MatchState, Variant } from '../core/types'

/** Soft disconnect / stand / Menu grace before the match is ended. */
export const MATCH_RESUME_GRACE_MS = 60_000

const KEY = 'canasta.matchResume.v1'

export type MatchResumeSnapshot = {
  until: number
  kind: 'solo' | 'mp'
  roomCode: string
  tableId?: string
  uid: string
  seat: number
  isHost: boolean
  state: MatchState
  variant: Variant
  house: HouseRules
  difficulty?: AiDifficulty
  localIndex: number
  playerName: string
}

export function saveMatchResume(snap: MatchResumeSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    /* quota / private mode */
  }
}

export function clearMatchResume(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function loadMatchResume(opts?: {
  uid?: string
  seat?: number
  tableId?: string
  roomCode?: string
}): MatchResumeSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as MatchResumeSnapshot
    if (!snap || typeof snap.until !== 'number' || !snap.state) {
      clearMatchResume()
      return null
    }
    if (Date.now() > snap.until) {
      clearMatchResume()
      return null
    }
    if (opts?.uid && snap.uid && opts.uid.toLowerCase() !== snap.uid.toLowerCase()) return null
    if (opts?.seat != null && snap.seat >= 0 && opts.seat !== snap.seat) return null
    if (opts?.tableId && snap.tableId && opts.tableId !== snap.tableId) return null
    if (opts?.roomCode && snap.roomCode && opts.roomCode.toUpperCase() !== snap.roomCode.toUpperCase()) return null
    return snap
  } catch {
    return null
  }
}

export function secondsLeft(until: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((until - now) / 1000))
}
