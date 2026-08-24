import { cardPoints, isBlackThree, isRedThree, type Card } from './cards'
import { isHandAndFoot, isSambaFamily } from './houseRules'
import { meldPoints } from './melds'
import {
  goingOutBonus,
  isRedThreeMeld,
  meldBonusPoints,
  redThreeInHandPenalty,
  scoreSambaRedThrees,
  teamMeetsGoOutRule,
} from './sambaRules'
import type { HouseRules, MatchState, PlayerState, TeamState, Variant } from './types'

export type TeamScoreBreak = {
  cardPoints: number
  canastaBonus: number
  redThreeScore: number
  goingOut: number
  handPenalty: number
  total: number
}

function deadwoodPoints(card: Card, house: HouseRules, sealedFoot: boolean, variant: Variant): number {
  if (isRedThree(card)) {
    if (sealedFoot) {
      return house.redThreeSealedFootPenalty ? house.redThreeSealedFootPenaltyPoints : 0
    }
    if (isSambaFamily(variant)) return 0
    return house.redThreeHandEndPenalty ? house.redThreeHandEndPenaltyPoints : 0
  }
  if (isBlackThree(card)) return house.blackThreeEndPenaltyPoints
  return cardPoints(card)
}

export function scoreRedThrees(
  team: TeamState,
  variant: Variant,
  house: HouseRules,
  laidOnly: boolean,
  goOutMet?: boolean,
  playerCount = 4,
): number {
  const n = team.redThrees.length
  if (isHandAndFoot(variant)) {
    if (!laidOnly || !house.redThreeScoreEnabled) return 0
    return n * house.redThreeScorePoints
  }
  if (isSambaFamily(variant)) {
    if (!laidOnly) return 0
    return scoreSambaRedThrees(n, goOutMet ?? false, playerCount)
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
  const house = cfg.house
  const goOutMet = teamMeetsGoOutRule(team.melds, cfg)
  let cardPts = 0
  let canastaBonus = 0
  for (const m of team.melds) {
    cardPts += meldPoints(m)
    canastaBonus += meldBonusPoints(m, cfg)
  }
  const red = scoreRedThrees(team, cfg.variant, house, true, goOutMet, state.players.length)
  let goingOut = 0
  if (wentOutTeam === teamIndex) {
    goingOut = goingOutBonus(cfg)
    if (cfg.concealedBonus) {
      const player = state.players[state.wentOutPlayer]
      if (player && player.team === teamIndex && player.concealedEligible) goingOut = 200
    }
  }
  let handPenalty = 0
  let redInHand = 0
  for (const p of state.players) {
    if (p.team !== teamIndex) continue
    for (const c of p.hand) {
      if (isRedThree(c)) redInHand++
      else handPenalty += deadwoodPoints(c, house, false, cfg.variant)
    }
    for (const c of p.foot) handPenalty += deadwoodPoints(c, house, true, cfg.variant)
  }
  if (isSambaFamily(cfg.variant)) {
    handPenalty += redThreeInHandPenalty(cfg, redInHand)
  }
  const total = cardPts + canastaBonus + red + goingOut - handPenalty
  return { cardPoints: cardPts, canastaBonus, redThreeScore: red, goingOut, handPenalty, total }
}

export function partnerIndex(state: MatchState, playerIndex: number): number {
  const me = state.players[playerIndex]
  if (!me) return -1
  return state.players.findIndex((p, i) => p.team === me.team && i !== playerIndex)
}

export function partnerOf(state: MatchState, playerIndex: number): PlayerState | null {
  const i = partnerIndex(state, playerIndex)
  return i >= 0 ? state.players[i]! : null
}

export { isRedThreeMeld }
