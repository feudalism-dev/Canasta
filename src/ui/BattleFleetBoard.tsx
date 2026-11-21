import { useEffect, useMemo, useState } from 'react'
import { battleFleetPrivateView } from '../core/battlefleet/publicBoard'
import { cellKey } from '../core/battlefleet/board'
import { shipCells, shipDef, survivingShipCount } from '../core/battlefleet/fleet'
import { fleetForSide, sideIdForPlayer, territoryForPlayer } from '../core/battlefleet/state'
import type {
  BattleFleetMove,
  BattleFleetState,
  Orientation,
  ShipKind,
} from '../core/battlefleet/types'
import { BOARD_SIZE, SHIP_DEFS } from '../core/battlefleet/types'
import {
  BattleFleetLegend,
  bfIdentityClass,
  bfSeaActive,
  bfTerritoryClass,
  colLabels,
  rowLabels,
  ShipKindIcon,
} from './battlefleetVisual'
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
  const mode = state.config.mode
  const myIdAttr =
    mode === 'teams' && me?.teamId
      ? `team-${me.teamId.toLowerCase()}`
      : me && me.seat >= 0
        ? `seat-${me.seat}`
        : ''

  const myIdentity = bfIdentityClass(mode, {
    seat: me?.seat,
    teamId: me?.teamId,
  })

  const markMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of view.public.marks) m.set(cellKey(c.x, c.y), c.mark)
    return m
  }, [view.public.marks])

  const sunkOwner = useMemo(() => {
    const m = new Map<string, string>()
    for (const ship of view.public.sunkShips) {
      const idClass =
        mode === 'teams'
          ? bfIdentityClass('teams', {
              teamId: ship.sideId === 'A' || ship.sideId === 'B' ? ship.sideId : null,
            })
          : (() => {
              const pl = state.players.find((p) => p.id === ship.sideId)
              return bfIdentityClass('ffa', { seat: pl?.seat })
            })()
      for (const c of ship.cells) m.set(cellKey(c.x, c.y), idClass)
    }
    return m
  }, [view.public.sunkShips, mode, state.players])

  const ownSet = useMemo(() => {
    return new Set(view.ownShipCells.map((c) => cellKey(c.x, c.y)))
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
      if (mode === 'teams') {
        return myFleet?.ships.map((s) => s.kind) ?? []
      }
      return me?.fleet?.ships.map((s) => s.kind) ?? []
    })(),
  )

  const teamStatus =
    mode === 'teams'
      ? (state.teams ?? []).map((t) => {
          const names = t.memberIds
            .map((id) => state.players.find((p) => p.id === id)?.name ?? id)
            .join(' + ')
          return {
            id: t.id,
            names,
            confirmed: t.fleet.confirmed,
          }
        })
      : []

  const turnName =
    state.players.find((p) => p.id === state.turnPlayerId)?.name ?? ''

  const gridModeClass =
    mode === 'teams'
      ? 'mode-teams'
      : state.config.playerCount === 2
        ? 'mode-ffa-2'
        : 'mode-ffa'

  return (
    <div className="bf-root" data-my-id={myIdAttr || undefined}>
      <div className="bf-header">
        <h2>Battle Fleet</h2>
        <div className="bf-msg">{error ? error : view.public.lastMessage}</div>
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
                const inTerr =
                  terr &&
                  x >= terr.x0 &&
                  y >= terr.y0 &&
                  x < terr.x0 + terr.width &&
                  y < terr.y0 + terr.height
                const seaActive = bfSeaActive(mode, state.config.playerCount, x, y)
                const terrClass = bfTerritoryClass(
                  mode,
                  state.config.playerCount,
                  x,
                  y,
                  state.players,
                )
                const isOwn = ownSet.has(k)
                const cls = [
                  'bf-cell',
                  'terr',
                  terrClass,
                  !seaActive ? 'inactive' : '',
                  isOwn && !mark ? `own ${myIdentity}` : '',
                  ownHitSet.has(k) && !mark ? 'hit' : '',
                  mark === 'miss' ? 'miss' : '',
                  mark === 'hit' ? 'hit' : '',
                  mark === 'sunk' ? `sunk ${sunkOwner.get(k) || ''}` : '',
                  preview.has(k) ? 'ship-preview' : '',
                  (placing && !fleetConfirmed && inTerr) ||
                  (myTurn && seaActive && !inTerr && !isOwn)
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
          <BattleFleetLegend />
        </div>

        <aside className="bf-side">
          <section className="bf-section">
            <h3 className="bf-section-title">Status</h3>
            <div className="bf-status-row">
              <span className="bf-pill">{state.phase}</span>
              <span className="bf-pill">{mode === 'teams' ? 'Teams' : 'FFA'}</span>
            </div>
            {mode === 'teams' && me?.teamId && (
              <div className="bf-team-line">
                <span className={`bf-chip ${myIdentity}`} /> Team {me.teamId}
                {partner ? ` with ${partner.name}` : ' (solo on team)'}
                {fleetConfirmed ? ' · fleet locked' : ' · shared fleet'}
              </div>
            )}
            {state.phase === 'battle' && (
              <div className="bf-team-line">
                {myTurn ? 'Your turn — click enemy waters.' : `Waiting${turnName ? ` · ${turnName}` : '…'}`}
              </div>
            )}
            {placing && fleetConfirmed && (
              <div className="bf-team-line">
                Fleet confirmed — waiting for opponents
                {mode === 'teams' ? ' / other team' : ''}.
              </div>
            )}
          </section>

          {placing && !fleetConfirmed && (
            <section className="bf-section">
              <h3 className="bf-section-title">Fleet placement</h3>
              <div className="bf-ships">
                {SHIP_DEFS.map((d) => (
                  <button
                    key={d.kind}
                    type="button"
                    className={selectedKind === d.kind ? 'active' : ''}
                    onClick={() => setSelectedKind(d.kind)}
                  >
                    <ShipKindIcon kind={d.kind} />
                    <span className="bf-ship-meta">
                      {d.label} ({d.length})
                    </span>
                    {placedKinds.has(d.kind) ? (
                      <span className="bf-ship-placed">✓</span>
                    ) : null}
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
                className="bf-primary"
                onClick={() =>
                  onMove({ type: 'confirmFleet', playerId: localPlayerId })
                }
              >
                Confirm fleet
              </button>
              {mode === 'teams' && (
                <p className="bf-hint">
                  Either teammate may place or confirm the shared fleet.
                </p>
              )}
              {teamStatus.length > 0 && (
                <ul className="bf-scores">
                  {teamStatus.map((t) => (
                    <li key={t.id}>
                      <span
                        className={`bf-chip ${bfIdentityClass('teams', { teamId: t.id })}`}
                      />
                      Team {t.id} ({t.names}): {t.confirmed ? 'ready' : 'placing…'}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {state.phase === 'gameEnd' && (
            <section className="bf-section">
              <h3 className="bf-section-title">Victory</h3>
              <div className="bf-results">
                <div className="bf-victory">
                  <strong>
                    {state.winnerTeamId
                      ? `Team ${state.winnerTeamId} wins`
                      : `${state.players.find((p) => p.id === state.winnerId)?.name ?? 'Winner'} wins`}
                  </strong>
                  <div className="bf-hint">Duration {formatDuration(state.startedAt)}</div>
                </div>
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
                          mode === 'teams' && p.teamId ? p.teamId : p.id
                        const fleet = fleetForSide(state, side)
                        const left = fleet ? survivingShipCount(fleet) : 0
                        const idClass = bfIdentityClass(mode, {
                          seat: p.seat,
                          teamId: p.teamId,
                        })
                        return (
                          <tr key={p.id}>
                            <td>
                              <span className={`bf-chip ${idClass}`} />{' '}
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
              {onNewMatch && (
                <button type="button" className="bf-primary" onClick={onNewMatch}>
                  New match
                </button>
              )}
            </section>
          )}

          {state.phase !== 'gameEnd' && (
            <section className="bf-section">
              <h3 className="bf-section-title">Scoreboard</h3>
              <ul className="bf-scores">
                {view.public.players.map((p) => {
                  const full = state.players.find((x) => x.id === p.id)
                  const idClass = bfIdentityClass(mode, {
                    seat: p.seat,
                    teamId: p.teamId,
                  })
                  return (
                    <li
                      key={p.id}
                      className={[
                        p.id === state.turnPlayerId ? 'is-turn' : '',
                        p.eliminated ? 'is-out' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className={`bf-chip ${idClass}`} />
                      <strong>{p.name}</strong>
                      {p.teamId ? ` [${p.teamId}]` : ''}
                      <span>
                        {p.score} pts · {p.shipsSunk} sunk · {p.shipsLeft} left
                      </span>
                      {full ? (
                        <span className="bf-hint">
                          {full.hits}H/{full.misses}M
                        </span>
                      ) : null}
                      {p.eliminated ? ' (out)' : ''}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {state.phase !== 'gameEnd' && onNewMatch && (
            <button type="button" onClick={onNewMatch}>
              New match
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
