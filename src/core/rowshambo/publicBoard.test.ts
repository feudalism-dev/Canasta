import { describe, expect, it } from 'vitest'
import { applyRowShamBoMove } from './rules'
import { createRowShamBoMatch } from './state'
import {
  decodeRowShamBoPublicBoard,
  encodeRowShamBoPublicBoard,
  idleRowShamBoPublicBoard,
  rowShamBoPublicBoardFromState,
} from './publicBoard'

describe('rowshambo publicBoard', () => {
  it('round-trips idle', () => {
    expect(encodeRowShamBoPublicBoard(idleRowShamBoPublicBoard())).toBe('W1~0~')
    expect(decodeRowShamBoPublicBoard('W1~0~').live).toBe(false)
  })

  it('encodes table plays and duel stages through resolve', () => {
    let state = createRowShamBoMatch(['A', 'B', 'C'], [false, true, true], 'classic', 100, 9)
    let res = applyRowShamBoMove(state, { t: 'ackDir' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    res = applyRowShamBoMove(state, { t: 'pass', cardId: state.players[0]!.hand[0]!.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    res = applyRowShamBoMove(state, { t: 'play', cardId: state.players[0]!.hand[0]!.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state

    // Preamble — all downs
    let board = rowShamBoPublicBoardFromState(state)
    expect(board.phase).toBe('resolve')
    expect(board.tablePlays.filter((p) => p === 'down').length).toBe(3)
    expect(board.duel?.subphase).toBe('idle')
    let wire = encodeRowShamBoPublicBoard(board)
    expect(wire.startsWith('W1~')).toBe(true)
    let again = decodeRowShamBoPublicBoard(wire)
    expect(again.tablePlays.filter((p) => p === 'down').length).toBe(3)
    expect(again.duel?.subphase).toBe('idle')

    res = applyRowShamBoMove(state, { t: 'ackResolve' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    board = rowShamBoPublicBoardFromState(state)
    expect(board.duel?.subphase).toBe('challengerDown')
    expect(board.duel?.stepIndex).toBe(0)
    const nextSeat = board.duel!.nextSeat
    expect(board.tablePlays[nextSeat] === 'down' || board.duel?.outcome === 'tie').toBe(true)
    again = decodeRowShamBoPublicBoard(encodeRowShamBoPublicBoard(board))
    expect(again.duel?.subphase).toBe('challengerDown')
    expect(again.duel?.nextSeat).toBe(nextSeat)

    state = { ...state, resolveAckAt: null }
    res = applyRowShamBoMove(state, { t: 'ackResolve' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    state = res.state
    board = rowShamBoPublicBoardFromState(state)
    expect(board.duel?.subphase).toBe('result')
    expect(board.duel?.outcome).toBeTruthy()
    expect(board.tablePlays[nextSeat]).not.toBe('down')
    expect(board.tablePlays[nextSeat]).not.toBeNull()
    again = decodeRowShamBoPublicBoard(encodeRowShamBoPublicBoard(board))
    expect(again.duel?.subphase).toBe('result')
    expect(again.duel?.outcome).toBe(board.duel?.outcome)
    expect(again.tablePlays[nextSeat]).toBe(board.tablePlays[nextSeat])
  })

  it('still decodes legacy payloads without arena section', () => {
    const legacy =
      'W1~1~c~2~1~1~100~r~0~c~40~Battle!^You:0:4:0:0,Bot:1:4:0:0'
    const board = decodeRowShamBoPublicBoard(legacy)
    expect(board.live).toBe(true)
    expect(board.phase).toBe('resolve')
    expect(board.players).toHaveLength(2)
    expect(board.tablePlays.every((p) => p == null)).toBe(true)
  })
})
