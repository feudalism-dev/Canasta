import { cardPoints, isRedThree } from './cards'
import { canastaKind, meldPoints } from './melds'
import type { MatchState, PlayerState, TeamState } from './types'

export type TeamScoreBreak = {
  cardPoints: number
  canastaBonus: number
  redThreeScore: number
  goingOut: number
  handPenalty: number
  total: number
}

export function scoreRedThrees(team: TeamState, variant: 'canasta' | 'handAndFoot', laidOnly: boolean): number {
  const n = team.redThrees.length
  if (variant === 'handAndFoot') {
    return laidOnly ? n * 100 : 0
  }
  if (n === 0) return 0
  const raw = n === 4 ? 800 : n * 100
  if (!team.hasInitialMeld && team.melds.length === 0) return -raw
  return raw
}

export function scoreTeamHand(
  state: MatchState,
  teamIndex: 0 | 1,
  wentOutTeam: number,
): TeamScoreBreak {
  const team = state.teams[teamIndex]!
  const cfg = state.config
  let cardPts = 0
  let canastaBonus = 0
  for (const m of team.melds) {
    cardPts += meldPoints(m)
    const kind = canastaKind(m, cfg.canastaSize)
    if (kind === 'natural') canastaBonus += 500
    else if (kind === 'mixed') canastaBonus += 300
    else if (kind === 'wild') canastaBonus += 1500
  }
  const red = scoreRedThrees(team, cfg.variant, true)
  let goingOut = 0
  if (wentOutTeam === teamIndex) {
    goingOut = 100
    if (cfg.concealedBonus) {
      const player = state.players[state.wentOutPlayer]
      if (player && player.team === teamIndex && player.concealedEligible) goingOut = 200
    }
  }
  let handPenalty = 0
  for (const p of state.players) {
    if (p.team !== teamIndex) continue
    for (const c of p.hand) {
      if (isRedThree(c) && cfg.variant === 'handAndFoot') handPenalty += 100
      else handPenalty += cardPoints(c)
    }
    for (const c of p.foot) {
      if (isRedThree(c) && cfg.variant === 'handAndFoot') handPenalty += 100
      else handPenalty += cardPoints(c)
    }
  }
  const total = cardPts + canastaBonus + red + goingOut - handPenalty
  return { cardPoints: cardPts, canastaBonus, redThreeScore: red, goingOut, handPenalty, total }
}

export function partnerOf(state: MatchState, playerIndex: number): PlayerState | null {
  const me = state.players[playerIndex]
  if (!me) return null
  const mates = state.players.filter((p, i) => p.team === me.team && i !== playerIndex)
  return mates[0] ?? null
}
