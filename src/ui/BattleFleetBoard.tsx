import { useEffect, useMemo, useState } from 'react'
import { battleFleetPrivateView } from '../core/battlefleet/publicBoard'
import { cellKey, ffaTerritory } from '../core/battlefleet/board'
import { shipCells, shipDef, survivingShipCount } from '../core/battlefleet/fleet'
import { fleetForSide, sideIdForPlayer, territoryForPlayer } from '../core/battlefleet/state'
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

function hitPct(hits: number, attacks: number): string {
  if (attacks <= 0) return '—'
  return `${Math.round((hits / attacks) * 100)}%`
}

function formatDuration(startedAt: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
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
  const me = state.players.find((p) => p.id === localPlayerId)
  const mySideId = sideIdForPlayer(state, localPlayerId)
  const myFleet = mySideId ? fleetForSide(state, mySideId) : null
  const fleetConfirmed = Boolean(myFleet?.confirmed)
  const partner =
    state.config.mode === 'teams' && me?.teamId
      ? state.players.find(
          (p) => p.teamId === me.teamId && p.id !== localPlayerId,
        )
      : null
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

  const ownHitSet = useMemo(() => {
    return new Set(view.ownHits.map((c) => cellKey(c.x, c.y)))
  }, [view.ownHits])

  const preview = useMemo(() => {
    if (!placing || fleetConfirmed || !hover || !terr) return new Set<string>()
    const cells = shipCells(
      hover.x,
      hover.y,
      shipDef(selectedKind).length,
      orientation,
    )
    return new Set(cells.map((c) => cellKey(c.x, c.y)))
  }, [placing, fleetConfirmed, hover, selectedKind, orientation, terr])

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
      if (fleetConfirmed) return
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

  const teamStatus =
    state.config.mode === 'teams'
      ? (state.teams ?? []).map((t) => {
          const names = t.memberIds
            .map((id) => state.players.find((p) => p.id === id)?.name ?? id)
            .join(' + ')
          return {
            id: t.id,
            names,
            confirmed: t.fleet.confirmed,
            left: survivingShipCount(t.fleet),
            eliminated: t.eliminated,
          }
        })
      : []

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
                ownSet.has(k) && !mark ? 'own' : '',
                ownHitSet.has(k) && !mark ? 'hit' : '',
                mark === 'miss' ? 'miss' : '',
                mark === 'hit' ? 'hit' : '',
                mark === 'sunk' ? 'sunk' : '',
                preview.has(k) ? 'ship-preview' : '',
                (placing && !fleetConfirmed && inTerr) ||
                (myTurn && seaActive && !inTerr && !ownSet.has(k))
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
                      ? !inTerr || fleetConfirmed
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
          {state.config.mode === 'teams' && me?.teamId && (
            <div className="bf-team-line">
              You: Team {me.teamId}
              {partner ? ` with ${partner.name}` : ' (solo on team)'}
              {fleetConfirmed ? ' · fleet locked' : ' · shared fleet'}
            </div>
          )}
          {placing && (
            <>
              {fleetConfirmed ? (
                <div className="bf-team-line">
                  Fleet confirmed — waiting for opponents
                  {state.config.mode === 'teams' ? ' / other team' : ''}.
                </div>
              ) : (
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
                  {state.config.mode === 'teams' && (
                    <p className="bf-hint">
                      Either teammate may place or confirm the shared fleet.
                    </p>
                  )}
                </>
              )}
              {teamStatus.length > 0 && (
                <ul className="bf-scores">
                  {teamStatus.map((t) => (
                    <li key={t.id}>
                      Team {t.id} ({t.names}):{' '}
                      {t.confirmed ? 'ready' : 'placing…'}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {state.phase === 'battle' && (
            <div>{myTurn ? 'Your turn — click enemy waters.' : 'Waiting…'}</div>
          )}
          {state.phase === 'gameEnd' && (
            <div className="bf-results">
              <strong>
                {state.winnerTeamId
                  ? `Team ${state.winnerTeamId} wins`
                  : `${state.players.find((p) => p.id === state.winnerId)?.name ?? 'Winner'} wins`}
              </strong>
              <div className="bf-hint">Duration {formatDuration(state.startedAt)}</div>
              <table className="bf-stats">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pts</th>
                    <th>Hit%</th>
                    <th>Sunk</th>
                    <th>Left</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.players]
                    .sort((a, b) => b.score - a.score)
                    .map((p) => {
                      const side =
                        state.config.mode === 'teams' && p.teamId
                          ? p.teamId
                          : p.id
                      const fleet = fleetForSide(state, side)
                      const left = fleet ? survivingShipCount(fleet) : 0
                      return (
                        <tr key={p.id}>
                          <td>
                            {p.name}
                            {p.teamId ? ` [${p.teamId}]` : ''}
                          </td>
                          <td>{p.score}</td>
                          <td>{hitPct(p.hits, p.attacks)}</td>
                          <td>{p.shipsSunk}</td>
                          <td>{left}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
              <ul className="bf-scores">
                {state.players.map((p) => (
                  <li key={`d-${p.id}`}>
                    {p.name}: {p.hits}H / {p.misses}M · {p.attacks} attacks
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.phase !== 'gameEnd' && (
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
          )}
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
