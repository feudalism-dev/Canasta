import { describe, expect, it } from 'vitest'
import { makeCard, type Card } from './cards'
import { coachAdvice, whatShouldIDo } from './coach'
import { createMatch } from './state'

function fillLow(n: number, seed = 40): Card[] {
  const ranks = ['4', '5', '6', '7', '8', '9'] as const
  const suits = ['H', 'D', 'S', 'C'] as const
  const out: Card[] = []
  for (let i = 0; i < n; i++) {
    out.push(makeCard(seed + i, suits[i % 4]!, ranks[i % ranks.length]!, 0))
  }
  return out
}

describe('coach', () => {
  it('omits tips unless they are requested', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    const quiet = coachAdvice(s, 0)
    expect(quiet.headline).toBe(whatShouldIDo(s, 0))
    expect(quiet.tip).toBe('')
    const talk = coachAdvice(s, 0, { tips: true })
    expect(talk.tip.length).toBeGreaterThan(20)
  })

  it('explains a frozen pile on the draw', () => {
    const s = createMatch({ variant: 'canasta', names: ['A', 'B'], humans: [true, true], seed: 2 })
    s.discardFrozen = true
    s.discard = [makeCard(1, 'H', 'K', 0)]
    s.players[0]!.hand = fillLow(8, 90)
    s.phase = 'awaitingDraw'
    s.currentPlayer = 0
    const { tip } = coachAdvice(s, 0, { tips: true })
    expect(tip).toMatch(/two natural/i)
  })

  it('teaches Hand and Foot to empty the Hand before the Foot', () => {
    const s = createMatch({ variant: 'handAndFoot', names: ['A', 'B'], humans: [true, true], seed: 4 })
    s.teams[0]!.hasInitialMeld = true
    s.players[0]!.hand = fillLow(8, 80)
    s.players[0]!.footPickedUp = false
    s.phase = 'awaitingPlay'
    s.currentPlayer = 0
    const { tip } = coachAdvice(s, 0, { tips: true })
    expect(tip).toMatch(/Foot/)
  })
})
