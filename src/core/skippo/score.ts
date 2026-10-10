import { cardPoints } from './deck'
import { partnerIndex } from './variants'
import type { SkippoState } from './types'

/** Award remaining stock points to the winner (and partner in Partners); advance match if playTo reached. */
export function scoreStockOut(state: SkippoState, winnerIndex: number): void {
  const winner = state.players[winnerIndex]!
  const partnerIdx = state.config.partners ? partnerIndex(state, winnerIndex) : null
  const partner = partnerIdx != null ? state.players[partnerIdx]! : null
  const scorers = new Set<string>([winner.id])
  if (partner) scorers.add(partner.id)

  const lines = state.players.map((p) => {
    if (scorers.has(p.id)) {
      return { playerId: p.id, name: p.name, delta: 0, total: p.score }
    }
    const delta = p.stock.reduce((sum, c) => sum + cardPoints(c), 0)
    return { playerId: p.id, name: p.name, delta, total: p.score }
  })
  let gained = 0
  for (const line of lines) {
    if (scorers.has(line.playerId)) continue
    gained += line.delta
  }
  winner.score += gained
  if (partner) partner.score += gained
  for (const line of lines) {
    if (scorers.has(line.playerId)) {
      line.delta = gained
      const pl = state.players.find((p) => p.id === line.playerId)!
      line.total = pl.score
    }
  }
  state.lastHandScores = lines
  state.winnerId = winner.id
  state.phase = 'roundEnd'
  const teamNote = partner
    ? `${winner.name} & ${partner.name} score +${gained} (stock empty).`
    : `${winner.name} empties their stock (+${gained}).`
  state.lastHandNote = teamNote
  state.lastMessage = teamNote
  state.log.push(teamNote)

  const playTo = state.config.playTo
  if (playTo != null && winner.score >= playTo) {
    state.phase = 'matchEnd'
    state.lastMessage = partner
      ? `${winner.name} & ${partner.name} win the match (${winner.score}).`
      : `${winner.name} wins the match (${winner.score}).`
    state.log.push(state.lastMessage)
  }
}
