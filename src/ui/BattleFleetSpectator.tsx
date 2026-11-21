import { useMemo } from 'react'
import { cellKey } from '../core/battlefleet/board'
import type { BattleFleetPublicBoard } from '../core/battlefleet/publicBoard'
import { BOARD_SIZE } from '../core/battlefleet/types'
import {
  BattleFleetLegend,
  bfIdentityClass,
  bfSeaActive,
  bfTerritoryClass,
  colLabels,
  rowLabels,
} from './battlefleetVisual'
import '../styles/battlefleet.css'

type Props = {
  board: BattleFleetPublicBoard
}

export function BattleFleetSpectator({ board }: Props) {
  const markMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of board.marks) m.set(cellKey(c.x, c.y), c.mark)
    return m
  }, [board.marks])

  const sunkOwner = useMemo(() => {
    const m = new Map<string, string>()
    for (const ship of board.sunkShips) {
      const idClass =
        board.mode === 'teams'
          ? bfIdentityClass('teams', {
              teamId: ship.sideId === 'A' || ship.sideId === 'B' ? ship.sideId : null,
            })
          : (() => {
              const pl = board.players.find((p) => p.id === ship.sideId)
              return bfIdentityClass('ffa', { seat: pl?.seat })
            })()
      for (const c of ship.cells) m.set(cellKey(c.x, c.y), idClass)
    }
    return m
  }, [board.sunkShips, board.mode, board.players])

  const gridModeClass =
    board.mode === 'teams'
      ? 'mode-teams'
      : board.playerCount === 2
        ? 'mode-ffa-2'
        : 'mode-ffa'

  return (
    <div className="bf-root">
      <div className="bf-header">
        <h2>Battle Fleet — Table</h2>
        <div className="bf-msg">{board.lastMessage}</div>
      </div>
      <div className="bf-layout">
        <div className="bf-board-wrap">
          <div className="bf-board-frame">
            <div className="bf-corner" />
            <div className="bf-col-labels">
              {colLabels().map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="bf-row-labels">
              {rowLabels().map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
            <div className={`bf-grid ${gridModeClass}`}>
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
                const x = i % BOARD_SIZE
                const y = Math.floor(i / BOARD_SIZE)
                const k = cellKey(x, y)
                const mark = markMap.get(k)
                const seaActive = bfSeaActive(board.mode, board.playerCount, x, y)
                const terrClass = bfTerritoryClass(
                  board.mode,
                  board.playerCount,
                  x,
                  y,
                  board.players,
                )
                const cls = [
                  'bf-cell',
                  'terr',
                  terrClass,
                  !seaActive ? 'inactive' : '',
                  mark === 'miss' ? 'miss' : '',
                  mark === 'hit' ? 'hit' : '',
                  mark === 'sunk' ? `sunk ${sunkOwner.get(k) || ''}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <div
                    key={k}
                    className={cls}
                    title={`${String.fromCharCode(65 + x)}${y + 1}`}
                  />
                )
              })}
            </div>
          </div>
          <BattleFleetLegend />
        </div>
        <aside className="bf-side">
          <section className="bf-section">
            <h3 className="bf-section-title">Status</h3>
            <div className="bf-status-row">
              <span className="bf-pill">{board.phase}</span>
              <span className="bf-pill">{board.mode === 'teams' ? 'Teams' : 'FFA'}</span>
            </div>
            {board.turnName ? (
              <div className="bf-team-line">Turn · {board.turnName}</div>
            ) : null}
          </section>

          {board.phase === 'gameEnd' && (
            <section className="bf-section">
              <h3 className="bf-section-title">Victory</h3>
              <div className="bf-victory">
                <strong>
                  {board.winnerTeamId
                    ? `Team ${board.winnerTeamId} wins`
                    : `${board.players.find((p) => p.id === board.winnerId)?.name ?? 'Winner'} wins`}
                </strong>
              </div>
            </section>
          )}

          <section className="bf-section">
            <h3 className="bf-section-title">Scoreboard</h3>
            <ul className="bf-scores">
              {board.players.map((p) => {
                const idClass = bfIdentityClass(board.mode, {
                  seat: p.seat,
                  teamId: p.teamId,
                })
                return (
                  <li
                    key={p.id}
                    className={[
                      p.id === board.turnPlayerId ? 'is-turn' : '',
                      p.eliminated ? 'is-out' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={`bf-chip ${idClass}`} />
                    <strong>{p.name}</strong>
                    {p.teamId ? ` [${p.teamId}]` : ''}
                    <span>
                      {p.score} · {p.shipsSunk} sunk · {p.shipsLeft} left
                    </span>
                    {p.eliminated ? ' (out)' : ''}
                  </li>
                )
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
