import { cardPoints } from './deck'
import type { PhaseItState } from './types'

/** End of hand: everyone scores leftover hand cards; phase-down players advance. */
export function scorePhaseItHand(state: PhaseItState, wentOutIndex: number): void {
  const lines = state.players.map((p, i) => {
    const delta = p.hand.reduce((sum, c) => sum + cardPoints(c), 0)
    return {
      playerId: p.id,
      name: p.name,
      delta,
      total: p.score + delta,
      phase: p.phase + (p.phaseDown || i === wentOutIndex ? 1 : 0),
    }
  })

  for (let i = 0; i < state.players.length; i++) {
    const pl = state.players[i]!
    const line = lines[i]!
    pl.score = line.total
    if (pl.phaseDown || i === wentOutIndex) {
      pl.phase = Math.min(10, pl.phase + 1)
    }
  }

  state.lastHandScores = lines
  state.phase = 'roundEnd'
  const winner = state.players[wentOutIndex]!
  state.lastHandNote = `${winner.name} goes out. Leftover cards score against each player.`
  state.lastMessage = state.lastHandNote
  state.log.push(state.lastHandNote)

  const finished = state.players.find((p) => p.phase >= 10)
  if (finished) {
    state.phase = 'matchEnd'
    state.winnerId = finished.id
    // Lowest score among those who finished phase 10, else the finisher
    const champs = state.players.filter((p) => p.phase >= 10)
    champs.sort((a, b) => a.score - b.score)
    const champ = champs[0]!
    state.winnerId = champ.id
    state.lastMessage = `${champ.name} completes Phase 10 and wins the match (${champ.score} pts).`
    state.log.push(state.lastMessage)
  }
}
