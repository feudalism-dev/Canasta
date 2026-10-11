import { categoryLabel, fiveKindCategory } from './categories'
import { isYahtzee, rollDice, valuesOf } from './dice'
import { openCategories, playerTotal, scoreWithJoker } from './score'
import { advanceAfterScore, cloneYotsy, currentPlayer } from './state'
import type { YotsyMove, YotsyState } from './types'

export type YotsyApplyResult =
  | { ok: true; state: YotsyState }
  | { ok: false; error: string }

export function applyYotsyMove(state: YotsyState, move: YotsyMove): YotsyApplyResult {
  if (state.phase === 'matchEnd') return { ok: false, error: 'Match is over' }
  const next = cloneYotsy(state)
  const me = next.current
  const pl = next.players[me]!
  const variant = next.config.variant

  if (move.t === 'toggleHold') {
    if (!next.hasRolled) return { ok: false, error: 'Roll first' }
    if (next.rollsLeft <= 0) return { ok: false, error: 'No rolls left — score a box' }
    const die = next.dice.find((d) => d.id === move.dieId)
    if (!die) return { ok: false, error: 'Bad die' }
    die.held = !die.held
    return { ok: true, state: next }
  }

  if (move.t === 'roll') {
    if (next.rollsLeft <= 0) return { ok: false, error: 'No rolls left' }
    if (!next.hasRolled) {
      for (const d of next.dice) d.held = false
    }
    next.dice = rollDice(next.dice, Date.now() % 1e9)
    next.rollsLeft -= 1
    next.hasRolled = true
    next.log.push(`${pl.name} rolls.`)
    next.lastMessage = `${pl.name} rolled — ${next.rollsLeft} roll${next.rollsLeft === 1 ? '' : 's'} left.`
    return { ok: true, state: next }
  }

  if (move.t === 'score') {
    if (!next.hasRolled) return { ok: false, error: 'Roll at least once' }
    const open = openCategories(pl.card, variant)
    if (!open.includes(move.category)) return { ok: false, error: 'Box already filled' }
    const vals = valuesOf(next.dice)
    const five = fiveKindCategory(variant)
    const fiveWasFilled = (pl.card[five] ?? 0) > 0
    const pts = scoreWithJoker(vals, move.category, pl.card, variant)
    pl.card[move.category] = pts
    pl.turnsDone += 1

    let bonusNote = ''
    if (fiveWasFilled && isYahtzee(vals) && move.category !== five) {
      const bonus = variant === 'kismet' ? 50 : 100
      pl.yahtzeeBonuses += bonus
      bonusNote =
        variant === 'kismet' ? ` (+${bonus} Kismet bonus)` : ` (+${bonus} Yotsy bonus)`
    }

    const note = `${pl.name} scores ${categoryLabel(move.category)} for ${pts}${bonusNote}. Total ${playerTotal(pl, variant)}.`
    next.lastScoreNote = note
    next.log.push(note)
    next.lastMessage = note
    advanceAfterScore(next)
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Unknown move' }
}

export { currentPlayer }
