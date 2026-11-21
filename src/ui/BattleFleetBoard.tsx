import { useEffect, useMemo, useState } from 'react'
import { battleFleetPrivateView } from '../core/battlefleet/publicBoard'
import { cellKey, ffaTerritory } from '../core/battlefleet/board'
import { shipCells, shipDef } from '../core/battlefleet/fleet'
import { territoryForPlayer } from '../core/battlefleet/state'
import type {
  BattleFleetMove,
  BattleFleetState,
  Orientation,
  ShipKind,
} from '../core/battlefleet/types'
import { BOARD_SIZE, SHIP_DEFS } from '../core/battlefleet/types'
import '../styles/battlefleet.css'

type Props = {
  state: BattleFleetState
  localPlayerId: string
  onMove: (move: BattleFleetMove) => void
  onNewMatch?: () => void
  error?: string | null
}

export function BattleFleetBoard({
  state,
  localPlayerId,
  onMove,
  onNewMatch,
  error,
}: Props) {
  const [selectedKind, setSelectedKind] = useState<ShipKind>('carrier')
  const [orientation, setOrientation] = useState<Orientation>('H')
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)

  const view = useMemo(
    () => battleFleetPrivateView(state, localPlayerId),
    [state, localPlayerId],
  )
  const terr = territoryForPlayer(state, localPlayerId)
  const myTurn = state.turnPlayerId === localPlayerId && state.phase === 'battle'
  const placing = state.phase === 'placement'

  const markMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of view.public.marks) m.set(cellKey(c.x, c.y), c.mark)
    return m
  }, [view.public.marks])

  const ownSet = useMemo(() => {
    const s = new Set(view.ownShipCells.map((c) => cellKey(c.x, c.y)))
    return s
  }, [view.ownShipCells])

  const preview = useMemo(() => {
    if (!placing || !hover || !terr) return new Set<string>()
    const cells = shipCells(
      hover.x,
      hover.y,
      shipDef(selectedKind).length,
      orientation,
    )
    return new Set(cells.map((c) => cellKey(c.x, c.y)))
  }, [placing, hover, selectedKind, orientation, terr])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setOrientation((o) => (o === 'H' ? 'V' : 'H'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onCellClick = (x: number, y: number) => {
    if (placing) {
      onMove({
        type: 'placeShip',
        playerId: localPlayerId,
        kind: selectedKind,
        x,
        y,
        orientation,
      })
      return
    }
    if (myTurn) {
      onMove({ type: 'fire', playerId: localPlayerId, x, y })
    }
  }

  const placedKinds = new Set(
    (() => {
      const side =
        state.config.mode === 'teams'
          ? state.players.find((p) => p.id === localPlayerId)?.teamId
          : localPlayerId
      if (!side) return [] as ShipKind[]
      if (state.config.mode === 'teams') {
        return state.teams?.find((t) => t.id === side)?.fleet.ships.map((s) => s.kind) ?? []
      }
      return (
        state.players.find((p) => p.id === localPlayerId)?.fleet?.ships.map((s) => s.kind) ??
        []
      )
    })(),
  )

  return (
    <div className="bf-root">
      <div className="bf-header">
        <h2>Battle Fleet</h2>
        <div className="bf-msg">
          {error ? error : view.public.lastMessage}
        </div>
      </div>
      <div className="bf-layout">
        <div className="bf-board-wrap">
          <div
            className="bf-grid"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, 14px)`,
            }}
          >
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
              const x = i % BOARD_SIZE
              const y = Math.floor(i / BOARD_SIZE)
              const k = cellKey(x, y)
              const mark = markMap.get(k)
              const inTerr =
                terr &&
                x >= terr.x0 &&
                y >= terr.y0 &&
                x < terr.x0 + terr.width &&
                y < terr.y0 + terr.height
              let seaActive = false
              if (state.config.mode === 'teams') {
                seaActive = true
              } else {
                for (let pi = 0; pi < state.config.playerCount; pi++) {
                  const t = ffaTerritory(pi, state.config.playerCount)
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
                ownSet.has(k) && placing ? 'own' : '',
                mark === 'miss' ? 'miss' : '',
                mark === 'hit' ? 'hit' : '',
                mark === 'sunk' ? 'sunk' : '',
                preview.has(k) ? 'ship-preview' : '',
                (placing && inTerr) || (myTurn && seaActive && !inTerr && !ownSet.has(k))
                  ? 'targetable'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <button
                  key={k}
                  type="button"
                  className={cls}
                  title={`${String.fromCharCode(65 + x)}${y + 1}`}
                  onMouseEnter={() => setHover({ x, y })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onCellClick(x, y)}
                  disabled={
                    placing
                      ? !inTerr
                      : !(myTurn && seaActive && !(terr && inTerr))
                  }
                />
              )
            })}
          </div>
        </div>
        <aside className="bf-side">
          <div>
            Phase: <strong>{state.phase}</strong>
            {state.config.mode === 'teams' ? ' · Teams' : ' · FFA'}
          </div>
          {placing && (
            <>
              <div className="bf-ships">
                {SHIP_DEFS.map((d) => (
                  <button
                    key={d.kind}
                    type="button"
                    className={selectedKind === d.kind ? 'active' : ''}
                    onClick={() => setSelectedKind(d.kind)}
                  >
                    {d.label} ({d.length})
                    {placedKinds.has(d.kind) ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOrientation((o) => (o === 'H' ? 'V' : 'H'))}
              >
                Rotate ({orientation}) — R
              </button>
              <button
                type="button"
                onClick={() =>
                  onMove({ type: 'randomPlace', playerId: localPlayerId })
                }
              >
                Random fleet
              </button>
              <button
                type="button"
                onClick={() =>
                  onMove({ type: 'confirmFleet', playerId: localPlayerId })
                }
              >
                Confirm fleet
              </button>
            </>
          )}
          {state.phase === 'battle' && (
            <div>{myTurn ? 'Your turn — click enemy waters.' : 'Waiting…'}</div>
          )}
          {state.phase === 'gameEnd' && (
            <div>
              <strong>
                {state.winnerTeamId
                  ? `Team ${state.winnerTeamId} wins`
                  : `${state.players.find((p) => p.id === state.winnerId)?.name ?? 'Winner'} wins`}
              </strong>
            </div>
          )}
          <div className="bf-scores">
            <ul>
              {view.public.players.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {p.teamId ? ` [${p.teamId}]` : ''}: {p.score} pts ·{' '}
                  {p.shipsSunk} sunk · {p.shipsLeft} left
                  {p.eliminated ? ' (out)' : ''}
                </li>
              ))}
            </ul>
          </div>
          {onNewMatch && (
            <button type="button" onClick={onNewMatch}>
              New match
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
