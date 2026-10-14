import { cardPoints } from './deck'
import { phasesToWin } from './phases'
import { isMastersVariant } from './variants'
import type { PhaseItState } from './types'

function completeActivePhase(state: PhaseItState, playerIndex: number): void {
  const pl = state.players[playerIndex]!
  if (pl.phase < 0) return
  const idx = pl.remaining.indexOf(pl.phase)
  if (idx >= 0) {
    pl.remaining = pl.remaining.filter((_, i) => i !== idx)
  }
  if (pl.remaining.length === 0) {
    pl.phase = phasesToWin(state.config.variant)
    return
  }
  if (isMastersVariant(state.config.variant)) {
    pl.phase = -1
  } else {
    pl.phase = pl.remaining[0]!
  }
}

/** End of hand: everyone scores leftover hand cards; phase-down players advance. */
export function scorePhaseItHand(state: PhaseItState, wentOutIndex: number): void {
  const winN = phasesToWin(state.config.variant)
  const lines = state.players.map((p, i) => {
    const delta = p.hand.reduce((sum, c) => sum + cardPoints(c), 0)
    const advances = p.phaseDown || i === wentOutIndex
    const nextPhase = advances
      ? p.remaining.length <= 1
        ? winN
        : isMastersVariant(state.config.variant)
          ? -1
          : (p.remaining.filter((x) => x !== p.phase)[0] ?? winN)
      : p.phase
    return {
      playerId: p.id,
      name: p.name,
      delta,
      total: p.score + delta,
      phase: nextPhase,
    }
  })

  for (let i = 0; i < state.players.length; i++) {
    const pl = state.players[i]!
    const line = lines[i]!
    pl.score = line.total
    if (pl.phaseDown || i === wentOutIndex) {
      completeActivePhase(state, i)
    } else if (isMastersVariant(state.config.variant) && pl.remaining.length > 0) {
      // Masters: re-pick each hand even if you failed.
      pl.phase = -1
    }
  }

  state.lastHandScores = lines
  state.phase = 'roundEnd'
  const winner = state.players[wentOutIndex]!
  state.lastHandNote = `${winner.name} goes out. Leftover cards score against each player.`
  state.lastMessage = state.lastHandNote
  state.log.push(state.lastHandNote)

  const finished = state.players.filter((p) => p.remaining.length === 0)
  if (finished.length) {
    state.phase = 'matchEnd'
    finished.sort((a, b) => a.score - b.score)
    const champ = finished[0]!
    state.winnerId = champ.id
    const label =
      state.config.variant === 'sprint'
        ? 'Sprint (phase 5)'
        : `Phase ${winN}`
    state.lastMessage = `${champ.name} completes ${label} and wins the match (${champ.score} pts).`
    state.log.push(state.lastMessage)
  }
}
