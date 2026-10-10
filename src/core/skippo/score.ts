import { cardPoints } from './deck'
import type { SkippoState } from './types'

/** Award remaining stock points to the winner; advance match if playTo reached. */
export function scoreStockOut(state: SkippoState, winnerIndex: number): void {
  const winner = state.players[winnerIndex]!
  const lines = state.players.map((p) => {
    if (p.id === winner.id) {
      return { playerId: p.id, name: p.name, delta: 0, total: p.score }
    }
    const delta = p.stock.reduce((sum, c) => sum + cardPoints(c), 0)
    return { playerId: p.id, name: p.name, delta, total: p.score }
  })
  let gained = 0
  for (const line of lines) {
    if (line.playerId === winner.id) continue
    gained += line.delta
  }
  winner.score += gained
  for (const line of lines) {
    if (line.playerId === winner.id) {
      line.delta = gained
      line.total = winner.score
    }
  }
  state.lastHandScores = lines
  state.winnerId = winner.id
  state.phase = 'roundEnd'
  state.lastHandNote = `${winner.name} empties their stock (+${gained}).`
  state.lastMessage = state.lastHandNote
  state.log.push(state.lastHandNote)

  const playTo = state.config.playTo
  if (playTo != null && winner.score >= playTo) {
    state.phase = 'matchEnd'
    state.lastMessage = `${winner.name} wins the match (${winner.score}).`
    state.log.push(state.lastMessage)
  }
}
