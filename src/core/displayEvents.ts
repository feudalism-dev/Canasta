import { isRedThree, isWild, type MeldRank } from './cards'
import { canastaKind } from './melds'
import { isHandAndFoot, isBolivia, isSamba } from './houseRules'
import type { GameMove, MatchState } from './types'

function rankPipe(rank: MeldRank | string): string {
  if (rank === 'WILD' || rank === 'JOKER') return 'JOKER'
  return String(rank)
}

/** Pipe events for the in-world display stub (`Docs/TABLE_DISPLAY.md`). */
export function eventsForMove(
  prev: MatchState,
  next: MatchState,
  move: GameMove,
  playerIndex: number,
): string[] {
  const seat = (next.players[playerIndex]?.seat ?? playerIndex) + 1
  const team = next.players[playerIndex]?.team ?? 0
  const out: string[] = []
  if (move.kind === 'drawStock') {
    out.push(`DRAW|${seat}|${team}|NONE|${prev.config.stockDraw}|`)
  }
  if (move.kind === 'takePile') {
    out.push(`TAKE_PILE|${seat}|${team}|NONE|${prev.discard.length}|`)
    if (prev.discardFrozen && !next.discardFrozen) out.push(`FREEZE|${seat}|${team}|NONE|0|`)
  }
  if (move.kind === 'discard') {
    const top = next.discard[next.discard.length - 1]
    const rank = top ? (isRedThree(top) ? '3R' : isWild(top) ? rankPipe(top.rank) : top.rank) : 'NONE'
    out.push(`DISCARD|${seat}|${team}|${rank}|1|`)
    if (!prev.discardFrozen && next.discardFrozen) out.push(`FREEZE|${seat}|${team}|NONE|1|`)
  }
  if (move.kind === 'meld' || move.kind === 'addToMeld') {
    const t = next.teams[team]!
    if (move.kind === 'addToMeld') {
      const m = t.melds[move.meldIndex]
      if (m) {
        out.push(`MELD|${seat}|${team}|${rankPipe(m.rank)}|${m.cards.length}|`)
        const kind = canastaKind(m, next.config.canastaSize)
        if (kind !== 'none' && prev.teams[team]!.melds[move.meldIndex] &&
          canastaKind(prev.teams[team]!.melds[move.meldIndex]!, prev.config.canastaSize) === 'none') {
          const v = kind === 'natural' ? 1 : kind === 'wild' ? 2 : 0
          out.push(`CANASTA|${seat}|${team}|${rankPipe(m.rank)}|${v}|`)
        }
      }
    } else {
      const prevMelds = prev.teams[team]!.melds
      t.melds.forEach((meld, i) => {
        const before = prevMelds[i]
        const grew = !before || before.rank !== meld.rank || before.cards.length !== meld.cards.length
        if (!grew) return
        out.push(`MELD|${seat}|${team}|${rankPipe(meld.rank)}|${meld.cards.length}|`)
        const kind = canastaKind(meld, next.config.canastaSize)
        const wasNone = !before || canastaKind(before, prev.config.canastaSize) === 'none'
        if (kind !== 'none' && wasNone) {
          const v = kind === 'natural' ? 1 : kind === 'wild' ? 2 : 0
          out.push(`CANASTA|${seat}|${team}|${rankPipe(meld.rank)}|${v}|`)
        }
      })
    }
  }
  if (prev.players[playerIndex] && !prev.players[playerIndex]!.footPickedUp && next.players[playerIndex]!.footPickedUp) {
    out.push(`FOOT|${seat}|${team}|NONE|1|`)
  }
  if (next.phase === 'awaitingDraw' && prev.currentPlayer !== next.currentPlayer) {
    const nSeat = (next.players[next.currentPlayer]?.seat ?? next.currentPlayer) + 1
    const nTeam = next.players[next.currentPlayer]?.team ?? 0
    out.push(`TURN|${nSeat}|${nTeam}|NONE|0|`)
  }
  if (next.phase === 'roundEnd' || next.phase === 'matchEnd') {
    out.push(`SCORE|${next.teams[0]!.score}|${next.teams[1]!.score}|NONE|0|`)
  }
  if (next.phase === 'matchEnd') {
    const game = isHandAndFoot(next.config.variant)
      ? 'h'
      : isBolivia(next.config.variant)
        ? 'b'
        : isSamba(next.config.variant)
          ? 's'
          : 'c'
    out.push(`GAME_OVER|${seat}|${next.winnerTeam}|NONE|0|${game}`)
  }
  return out
}

export function startPayload(kind: 'solo' | 'match', nPlayers: number, humanSeat: number, uids: string[]): string {
  if (kind === 'solo') return `solo|${nPlayers}|${humanSeat}|${uids.join('|')}`
  return `match|${uids.join('|')}`
}
