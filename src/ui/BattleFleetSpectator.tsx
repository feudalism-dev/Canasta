import { useMemo } from 'react'
import { cellKey, ffaTerritory } from '../core/battlefleet/board'
import type { BattleFleetPublicBoard } from '../core/battlefleet/publicBoard'
import { BOARD_SIZE } from '../core/battlefleet/types'
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

  const sunkSet = useMemo(() => {
    const s = new Set<string>()
    for (const ship of board.sunkShips) {
      for (const c of ship.cells) s.add(cellKey(c.x, c.y))
    }
    return s
  }, [board.sunkShips])

  return (
    <div className="bf-root">
      <div className="bf-header">
        <h2>Battle Fleet — Table</h2>
        <div className="bf-msg">{board.lastMessage}</div>
      </div>
      <div className="bf-layout">
        <div className="bf-board-wrap">
          <div
            className="bf-grid"
            style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 14px)` }}
          >
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
              const x = i % BOARD_SIZE
              const y = Math.floor(i / BOARD_SIZE)
              const k = cellKey(x, y)
              const mark = sunkSet.has(k) ? 'sunk' : markMap.get(k)
              let seaActive = board.mode === 'teams'
              if (!seaActive) {
                for (let pi = 0; pi < board.playerCount; pi++) {
                  const t = ffaTerritory(pi, board.playerCount)
                  if (
                    t &&
                    x >= t.x0 &&
                    y >= t.y0 &&
                    x < t.x0 + t.width &&
                    y < t.y0 + t.height
                  ) {
                    seaActive = true
                    break
                  }
                }
              }
              const cls = [
                'bf-cell',
                !seaActive ? 'inactive' : '',
                mark === 'miss' ? 'miss' : '',
                mark === 'hit' ? 'hit' : '',
                mark === 'sunk' ? 'sunk' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return <div key={k} className={cls} title={`${String.fromCharCode(65 + x)}${y + 1}`} />
            })}
          </div>
        </div>
        <aside className="bf-side">
          <div>
            {board.phase}
            {board.turnName ? ` · ${board.turnName}` : ''}
          </div>
          {board.phase === 'gameEnd' && (
            <div>
              <strong>
                {board.winnerTeamId
                  ? `Team ${board.winnerTeamId} wins`
                  : `${board.players.find((p) => p.id === board.winnerId)?.name ?? 'Winner'} wins`}
              </strong>
            </div>
          )}
          <ul className="bf-scores">
            {board.players.map((p) => (
              <li key={p.id}>
                {p.name}
                {p.teamId ? ` [${p.teamId}]` : ''}: {p.score} · {p.shipsSunk} sunk ·{' '}
                {p.shipsLeft} left
                {p.eliminated ? ' (out)' : ''}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
