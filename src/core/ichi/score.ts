import { cardPoints } from './deck'
import type { IchiHandScoreLine, IchiState } from './types'

export function scoreShedHand(state: IchiState, winnerIdx: number, side: 'light' | 'dark' = 'light'): void {
  const winner = state.players[winnerIdx]!
  let total = 0
  const deltas = new Map<string, number>()
  for (let i = 0; i < state.players.length; i++) {
    const pl = state.players[i]!
    if (i === winnerIdx) {
      deltas.set(pl.id, 0)
      continue
    }
    const handPts = pl.hand.reduce((s, c) => s + cardPoints(c, side), 0)
    const upPts = (pl.palaceUp ?? []).reduce((s, c) => s + cardPoints(c, side), 0)
    const downPts = (pl.palaceDown ?? []).reduce((s, c) => s + cardPoints(c, side), 0)
    total += handPts + upPts + downPts
    deltas.set(pl.id, 0)
  }
  winner.score += total
  deltas.set(winner.id, total)
  if (state.config.variant === 'palace') {
    winner.handsWon = (winner.handsWon ?? 0) + 1
  }
  const parts = state.players.map((p) => {
    const d = deltas.get(p.id) ?? 0
    const won = state.config.variant === 'palace' ? ` · ${p.handsWon ?? 0} wins` : ''
    return `${p.name} ${d > 0 ? '+' : ''}${d} (${p.score}${won})`
  })
  state.lastHandNote = `${winner.name} goes out — scores ${total}. ${parts.join('; ')}`
  state.lastHandScores = state.players.map(
    (p): IchiHandScoreLine => ({
      playerId: p.id,
      name: p.name,
      delta: deltas.get(p.id) ?? 0,
      total: p.score,
    }),
  )
  state.log.push(state.lastHandNote)
  state.lastMessage = state.lastHandNote
  state.phase = 'roundEnd'

  const target = state.config.playTo
  if (target != null) {
    if (state.config.variant === 'palace') {
      const champ = state.players.find((p) => (p.handsWon ?? 0) >= target)
      if (champ) {
        state.phase = 'matchEnd'
        state.winnerId = champ.id
        state.log.push(`Match over — ${champ.name} wins ${champ.handsWon} hands.`)
        state.lastMessage = state.log[state.log.length - 1]!
      }
      return
    }
    const sorted = [...state.players].sort((a, b) => b.score - a.score)
    if (sorted[0]!.score >= target) {
      if (sorted[1] && sorted[0]!.score === sorted[1]!.score) {
        state.log.push(`Tied at ${sorted[0]!.score} — play another hand.`)
      } else {
        state.phase = 'matchEnd'
        state.winnerId = sorted[0]!.id
        state.log.push(`Match over — ${sorted[0]!.name} wins with ${sorted[0]!.score}.`)
        state.lastMessage = state.log[state.log.length - 1]!
      }
    }
  }
}
