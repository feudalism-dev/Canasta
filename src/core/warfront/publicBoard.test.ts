import { describe, expect, it } from 'vitest'
import {
  decodeWarfrontPublicBoard,
  encodeWarfrontPublicBoard,
  isWarfrontBoardPayload,
  warfrontPublicBoardFromState,
} from './publicBoard'
import { createWarfrontMatch } from './state'

describe('warfront compact board wire', () => {
  it('round-trips encode/decode under budget', () => {
    const state = createWarfrontMatch(
      ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      [false, true, true, true],
      'land',
      'ffa',
      'normal',
      5,
    )
    const board = warfrontPublicBoardFromState(state)
    const wire = encodeWarfrontPublicBoard(board)
    expect(isWarfrontBoardPayload(wire)).toBe(true)
    expect(wire.length).toBeLessThan(1500)
    const decoded = decodeWarfrontPublicBoard(wire)
    expect(decoded.players).toHaveLength(4)
    expect(decoded.zones).toHaveLength(28)
    expect(decoded.theater).toBe('land')
    expect(decoded.round).toBeGreaterThanOrEqual(1)
  })

  it('idle payload is tiny', () => {
    const wire = encodeWarfrontPublicBoard({
      live: false,
      theater: 'land',
      align: 'ffa',
      playerCount: 0,
      phase: 'idle',
      turnPlayerId: null,
      turnName: '',
      lastMessage: '',
      players: [],
      zones: [],
      layout: [],
      winnerId: null,
      winnerTeamId: null,
      round: 0,
    })
    expect(wire).toBe('W1~0~')
  })
})
