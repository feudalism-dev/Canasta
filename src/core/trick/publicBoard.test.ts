import { describe, expect, it } from 'vitest'
import { createTrickMatch } from './state'
import { applyTrickMove, legalPlays } from './rules'
import {
  decodeTrickPublicBoard,
  encodeTrickPublicBoard,
  isTrickBoardPayload,
  trickPublicBoardFromState,
} from './publicBoard'

describe('trick public board', () => {
  it('round-trips a live Hearts deal', () => {
    const state = createTrickMatch(['Alice', 'Bot', 'Carol', 'Dave'], [false, true, true, true], 'hearts', 7)
    const pub = trickPublicBoardFromState(state)
    const wire = encodeTrickPublicBoard(pub)
    expect(isTrickBoardPayload(wire)).toBe(true)
    expect(wire.startsWith('T1~1~h~')).toBe(true)

    const again = decodeTrickPublicBoard(wire)
    expect(again.live).toBe(true)
    expect(again.variant).toBe('hearts')
    expect(again.playerCount).toBe(4)
    expect(again.players).toHaveLength(4)
    expect(again.players[0]!.name).toBe('Alice')
    expect(again.players[0]!.handCount).toBe(13)
    expect(again.phase).toBe('pass')
  })

  it('includes face-up trick cards after a lead', () => {
    let state = createTrickMatch(['A', 'B', 'C', 'D'], [false, true, true, true], 'hearts', 3)
    while (state.phase === 'pass') {
      const hand = state.players[state.current]!.hand
      const ids = hand.slice(0, 3).map((c) => c.id)
      const res = applyTrickMove(state, { t: 'pass', cardIds: ids })
      expect(res.ok).toBe(true)
      if (res.ok) state = res.state
    }
    const lead = legalPlays(state, state.current)[0]!
    const played = applyTrickMove(state, { t: 'play', cardId: lead.id })
    expect(played.ok).toBe(true)
    if (!played.ok) return
    const pub = trickPublicBoardFromState(played.state)
    expect(pub.trick).toHaveLength(1)
    const again = decodeTrickPublicBoard(encodeTrickPublicBoard(pub))
    expect(again.trick).toHaveLength(1)
    expect(again.trick[0]!.card.rank).toBe(lead.rank)
    expect(again.trick[0]!.card.suit).toBe(lead.suit)
  })

  it('encodes idle as T1~0~', () => {
    expect(encodeTrickPublicBoard(decodeTrickPublicBoard('T1~0~'))).toBe('T1~0~')
  })
})
