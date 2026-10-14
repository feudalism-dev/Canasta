import { describe, expect, it } from 'vitest'
import {
  decodePhaseItPublicBoard,
  encodePhaseItPublicBoard,
  isPhaseItBoardPayload,
  phaseItPublicBoardFromState,
} from './publicBoard'
import { createPhaseItMatch } from './state'

describe('phaseit public board', () => {
  it('round-trips encode/decode', () => {
    const state = createPhaseItMatch(['Ada', 'Bot'], [false, true], 'classic', 99)
    const board = phaseItPublicBoardFromState(state)
    const wire = encodePhaseItPublicBoard(board)
    expect(isPhaseItBoardPayload(wire)).toBe(true)
    expect(wire.startsWith('P1~')).toBe(true)
    const back = decodePhaseItPublicBoard(wire)
    expect(back.live).toBe(true)
    expect(back.playerCount).toBe(2)
    expect(back.players).toHaveLength(2)
    expect(back.players[0]!.name).toBe('Ada')
    expect(back.topDiscard).not.toBeNull()
  })

  it('idle payload', () => {
    expect(decodePhaseItPublicBoard('P1~0~').live).toBe(false)
  })

  it('encodes masters / sprint variant letters', () => {
    const masters = createPhaseItMatch(['Ada', 'Bot'], [false, true], 'masters', 5)
    const mWire = encodePhaseItPublicBoard(phaseItPublicBoardFromState(masters))
    expect(mWire.split('~')[2]).toBe('m')
    expect(decodePhaseItPublicBoard(mWire).variant).toBe('masters')
    expect(decodePhaseItPublicBoard(mWire).players[0]!.phase).toBe(-1)

    const sprint = createPhaseItMatch(['Ada', 'Bot'], [false, true], 'sprint', 6)
    const sWire = encodePhaseItPublicBoard(phaseItPublicBoardFromState(sprint))
    expect(sWire.split('~')[2]).toBe('s')
    expect(decodePhaseItPublicBoard(sWire).variant).toBe('sprint')
  })
})
