import { useEffect, useMemo, useRef, useState } from 'react'
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
} from './battlefleetVisual'
import { BattleFleetShipLayer } from './BattleFleetShipLayer'
import {
  BF_CHROME,
  BF_FX,
  BF_SHIP_SRC,
  orientFromCells,
  type BfSpriteShip,
} from './battlefleetSprites'
import '../styles/battlefleet.css'

type Props = {
  state: BattleFleetState
  localPlayerId: string
  onMove: (move: BattleFleetMove) => void
  onNewMatch?: () => void
  error?: string | null
}

type CellFx = { key: string; kind: 'hit' | 'miss' | 'sunk'; x: number; y: number }

type SunkBanner = {
  key: string
  title: string
  detail: string
  kind: ShipKind
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
  const [fx, setFx] = useState<CellFx | null>(null)
  const [sunkBanner, setSunkBanner] = useState<SunkBanner | null>(null)
  const [msgPulse, setMsgPulse] = useState(false)
  const prevShotCount = useRef(0)
  const prevTurn = useRef<string | null>(null)

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

  const ownSet = useMemo(() => {
    return new Set(view.ownShipCells.map((c) => cellKey(c.x, c.y)))
  }, [view.ownShipCells])

  const spriteShips = useMemo(() => {
    const list: BfSpriteShip[] = []
    // Own fleet (intact or sunk)
    if (myFleet) {
      for (const ship of myFleet.ships) {
        list.push({
          key: `own-${ship.kind}`,
          kind: ship.kind,
          cells: ship.cells,
          orient: orientFromCells(ship.cells),
          sunk: ship.sunk,
        })
      }
    }
    // Enemy sunk wrecks only (fog of war)
    for (const sunk of view.public.sunkShips) {
      if (mode === 'teams') {
        if (sunk.sideId === me?.teamId) continue
      } else if (sunk.sideId === localPlayerId) {
        continue
      }
      list.push({
        key: `sunk-${sunk.sideId}-${sunk.kind}`,
        kind: sunk.kind,
        cells: sunk.cells,
        orient: orientFromCells(sunk.cells),
        sunk: true,
      })
    }
    // Placement preview ghost
    if (placing && !fleetConfirmed && hover && terr) {
      const cells = shipCells(
        hover.x,
        hover.y,
        shipDef(selectedKind).length,
        orientation,
      )
      const ok = cells.every(
        (c) =>
          c.x >= terr.x0 &&
          c.y >= terr.y0 &&
          c.x < terr.x0 + terr.width &&
          c.y < terr.y0 + terr.height,
      )
      if (ok) {
        list.push({
          key: `ghost-${selectedKind}`,
          kind: selectedKind,
          cells,
          orient: orientation,
          sunk: false,
          ghost: true,
        })
      }
    }
    return list
  }, [
    myFleet,
    view.public.sunkShips,
    mode,
    me?.teamId,
    localPlayerId,
    placing,
    fleetConfirmed,
    hover,
    terr,
    selectedKind,
    orientation,
  ])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setOrientation((o) => (o === 'H' ? 'V' : 'H'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const n = state.shots.length
    if (n <= prevShotCount.current) {
      prevShotCount.current = n
      return
    }
    prevShotCount.current = n
    const shot = state.shots[n - 1]
    if (!shot) return
    const kind: CellFx['kind'] =
      shot.result === 'miss' ? 'miss' : shot.result === 'sunk' ? 'sunk' : 'hit'
    setFx({ key: cellKey(shot.x, shot.y), kind, x: shot.x, y: shot.y })
    const fxTimer = window.setTimeout(() => setFx(null), 620)

    let bannerTimer: number | undefined
    if (shot.result === 'sunk' && shot.sunkKind) {
      const label = shipDef(shot.sunkKind).label
      const mySide = sideIdForPlayer(state, localPlayerId)
      if (shot.byPlayerId === localPlayerId) {
        setSunkBanner({
          key: `${n}-${shot.sunkKind}-you`,
          title: `You sunk a ${label}`,
          detail: 'Enemy vessel destroyed',
          kind: shot.sunkKind,
        })
        bannerTimer = window.setTimeout(() => setSunkBanner(null), 2800)
      } else if (mySide && shot.targetSideId === mySide) {
        setSunkBanner({
          key: `${n}-${shot.sunkKind}-lost`,
          title: `Your ${label} was sunk`,
          detail: 'Fleet reduced',
          kind: shot.sunkKind,
        })
        bannerTimer = window.setTimeout(() => setSunkBanner(null), 2800)
      }
    }

    return () => {
      window.clearTimeout(fxTimer)
      if (bannerTimer != null) window.clearTimeout(bannerTimer)
    }
  }, [state, localPlayerId])

  useEffect(() => {
    if (state.phase !== 'battle') return
    if (prevTurn.current === state.turnPlayerId) return
    prevTurn.current = state.turnPlayerId
    setMsgPulse(true)
    const t = window.setTimeout(() => setMsgPulse(false), 550)
    return () => window.clearTimeout(t)
  }, [state.turnPlayerId, state.phase])

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
    mode === 'teams'
      ? (myFleet?.ships.map((s) => s.kind) ?? [])
      : (me?.fleet?.ships.map((s) => s.kind) ?? []),
  )

  const teamStatus =
    mode === 'teams'
      ? (state.teams ?? []).map((t) => {
          const names = t.memberIds
            .map((id) => state.players.find((p) => p.id === id)?.name ?? id)
            .join(' + ')
          return { id: t.id, names, confirmed: t.fleet.confirmed }
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

  const rootClass = [
    'bf-root',
    'bf-sprites',
    myTurn ? 'is-my-turn' : '',
    state.phase === 'gameEnd' ? 'is-victory' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      data-my-id={myIdAttr || undefined}
      style={{
        ['--bf-corner-url' as string]: `url(${BF_CHROME.corner})`,
        ['--bf-mark-miss' as string]: `url(${BF_FX.ripple})`,
        ['--bf-mark-hit' as string]: `url(${BF_FX.smoke})`,
      }}
    >
      {sunkBanner ? (
        <div className="bf-sunk-banner" key={sunkBanner.key} role="status">
          <img
            className="bf-sunk-banner-ship"
            src={BF_SHIP_SRC[sunkBanner.kind].sunk}
            alt=""
          />
          <div className="bf-sunk-banner-text">
            <strong>{sunkBanner.title}</strong>
            <span>{sunkBanner.detail}</span>
          </div>
        </div>
      ) : null}
      <div className="bf-header">
        <div className="bf-header-brand">
          <img className="bf-chrome-compass" src={BF_CHROME.compass} alt="" />
          <h2>Battle Fleet</h2>
        </div>
        <div className={`bf-msg${msgPulse ? ' bf-msg-pulse' : ''}`}>
          {error ? error : view.public.lastMessage}
        </div>
      </div>
      <div className="bf-layout">
        <div className="bf-board-wrap">
          <span className="bf-corner-deco tl" />
          <span className="bf-corner-deco tr" />
          <span className="bf-corner-deco bl" />
          <span className="bf-corner-deco br" />
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
              <BattleFleetShipLayer ships={spriteShips} />
              {fx ? (
                <img
                  className={`bf-fx-sprite bf-fx-${fx.kind}`}
                  src={fx.kind === 'miss' ? BF_FX.splash : BF_FX.explosion}
                  alt=""
                  style={{
                    left: `calc(${fx.x} * (var(--bf-cell) + 1px) + var(--bf-cell) / 2)`,
                    top: `calc(${fx.y} * (var(--bf-cell) + 1px) + var(--bf-cell) / 2)`,
                  }}
                />
              ) : null}
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
                  mark === 'miss' ? 'miss' : '',
                  mark === 'hit' ? 'hit' : '',
                  mark === 'sunk' ? 'sunk' : '',
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
            <h3 className="bf-section-title">
              <img className="bf-chrome-radar" src={BF_CHROME.radar} alt="" />
              Status
            </h3>
            <div className="bf-status-row">
              <span className="bf-pill">{state.phase}</span>
              <span className="bf-pill">{mode === 'teams' ? 'Teams' : 'FFA'}</span>
              {state.phase === 'battle' && (
                <span className={`bf-pill${myTurn ? ' bf-pill-turn' : ''}`}>
                  {myTurn ? 'Your turn' : turnName || 'Waiting'}
                </span>
              )}
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
                {myTurn
                  ? 'Select enemy waters to fire.'
                  : `Standing by${turnName ? ` — ${turnName}` : '…'}`}
              </div>
            )}
            {placing && fleetConfirmed && (
              <div className="bf-team-line">
                Fleet confirmed — waiting for opponents
                {mode === 'teams' ? ' / other team' : ''}.
              </div>
            )}
          </section>

          <img className="bf-chrome-divider" src={BF_CHROME.divider} alt="" />

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
                    <img
                      className="bf-ship-thumb"
                      src={BF_SHIP_SRC[d.kind].intact}
                      alt=""
                    />
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
              <h3 className="bf-section-title">
                <img className="bf-chrome-anchor" src={BF_CHROME.anchor} alt="" />
                Victory
              </h3>
              <div className="bf-results">
                <div className="bf-victory">
                  <strong>
                    {state.winnerTeamId
                      ? `Team ${state.winnerTeamId} victorious`
                      : `${state.players.find((p) => p.id === state.winnerId)?.name ?? 'Winner'} victorious`}
                  </strong>
                  <div className="bf-victory-sub">
                    Engagement complete · {formatDuration(state.startedAt)}
                  </div>
                </div>
                <table className="bf-stats">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Pts</th>
                      <th>Hit%</th>
                      <th>Destroyed</th>
                      <th>Afloat</th>
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
              <h3 className="bf-section-title">
                <img className="bf-chrome-anchor" src={BF_CHROME.anchor} alt="" />
                Scoreboard
              </h3>
              <p className="bf-score-legend">
                Destroyed = enemy ships they sank · Afloat = ships still in their
                fleet
              </p>
              <ul className="bf-scores">
                {view.public.players.map((p) => {
                  const full = state.players.find((x) => x.id === p.id)
                  const idClass = bfIdentityClass(mode, {
                    seat: p.seat,
                    teamId: p.teamId,
                  })
                  const isMe = p.id === localPlayerId
                  return (
                    <li
                      key={p.id}
                      className={[
                        p.id === state.turnPlayerId ? 'is-turn' : '',
                        p.eliminated ? 'is-out' : '',
                        isMe ? 'is-me' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className={`bf-chip ${idClass}`} />
                      <strong>
                        {p.name}
                        {isMe ? ' (you)' : ''}
                      </strong>
                      {p.teamId ? ` [${p.teamId}]` : ''}
                      <span className="bf-score-num">{p.score}</span>
                      <span className="bf-score-line">
                        Destroyed {p.shipsSunk} · Afloat {p.shipsLeft}
                      </span>
                      {full ? (
                        <span className="bf-hint">
                          {hitPct(full.hits, full.attacks)} · {full.hits}H/{full.misses}M
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
