import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { areAdjacent } from '../core/warfront/map'
import { facilityLabel } from '../core/warfront/state'
import {
  estimateAtk,
  estimateDef,
  hasUnits,
  occupationCount,
  stackCount,
} from '../core/warfront/stacks'
import {
  unitCatalog,
  type UnitStack,
  type WarfrontMove,
  type WarfrontState,
  type WarfrontUnit,
} from '../core/warfront/types'
import '../styles/warfront.css'

type Props = {
  state: WarfrontState
  localPlayerId: string
  error?: string | null
  onMove: (move: WarfrontMove) => void
  onNewMatch?: () => void
  onLeave?: () => void
}

const SIDE_COLORS = ['#2a9d8f', '#e9c46a', '#9b5de5', '#f4a261']

export function WarfrontBoard({
  state,
  localPlayerId,
  error,
  onMove,
  onNewMatch,
  onLeave,
}: Props) {
  const local = state.players.find((p) => p.id === localPlayerId)
  const myTurn = state.turnPlayerId === localPlayerId && state.phase !== 'gameEnd'
  const [selected, setSelected] = useState<number | null>(null)
  const [moveFrom, setMoveFrom] = useState<number | null>(null)
  const [cam, setCam] = useState({ x: 0.5, y: 0.5, zoom: 1 })
  const dragRef = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  const home = local?.homeZoneId ?? 0

  const recenter = useCallback(
    (zoneId?: number) => {
      const id = zoneId ?? selected ?? home
      const lay = state.layout[id]
      if (!lay) return
      setCam((c) => ({ ...c, x: lay.x, y: lay.y }))
    },
    [home, selected, state.layout],
  )

  useEffect(() => {
    recenter(home)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = 0.06 / cam.zoom
      if (e.key === 'ArrowUp') setCam((c) => ({ ...c, y: Math.max(0, c.y - step) }))
      if (e.key === 'ArrowDown') setCam((c) => ({ ...c, y: Math.min(1, c.y + step) }))
      if (e.key === 'ArrowLeft') setCam((c) => ({ ...c, x: Math.max(0, c.x - step) }))
      if (e.key === 'ArrowRight') setCam((c) => ({ ...c, x: Math.min(1, c.x + step) }))
      if (e.key === '=' || e.key === '+') setCam((c) => ({ ...c, zoom: Math.min(2.5, c.zoom + 0.15) }))
      if (e.key === '-') setCam((c) => ({ ...c, zoom: Math.max(0.55, c.zoom - 0.15) }))
      if (e.key === 'Home') recenter(home)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cam.zoom, home, recenter])

  const catalog = unitCatalog(state.config.theater)
  const facName = facilityLabel(state.config.theater)

  const ownerColor = (ownerId: string | null) => {
    if (!ownerId) return 'rgba(180,180,160,0.25)'
    const idx = state.players.findIndex((p) => p.id === ownerId)
    return SIDE_COLORS[idx % SIDE_COLORS.length] ?? '#888'
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.12 : 0.12
    setCam((c) => ({ ...c, zoom: Math.min(2.5, Math.max(0.55, c.zoom + delta)) }))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.wf-zone')) return
    dragRef.current = { px: e.clientX, py: e.clientY, cx: cam.x, cy: cam.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const dx = (e.clientX - d.px) / rect.width / cam.zoom
    const dy = (e.clientY - d.py) / rect.height / cam.zoom
    setCam((c) => ({
      ...c,
      x: Math.min(1, Math.max(0, d.cx - dx)),
      y: Math.min(1, Math.max(0, d.cy - dy)),
    }))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const selectZone = (id: number) => {
    setSelected(id)
    if (!myTurn) return
    const z = state.zones[id]!
    if (state.phase === 'move' && !state.moved) {
      if (moveFrom == null) {
        if (z.ownerId === localPlayerId && hasUnits(z.units)) setMoveFrom(id)
      } else if (moveFrom === id) {
        setMoveFrom(null)
      } else if (areAdjacent(state.adj, moveFrom, id)) {
        const fromZ = state.zones[moveFrom]!
        // Move all occupation-capable + support (leave nothing if single stack attack into enemy)
        const units: UnitStack = { ...fromZ.units }
        if (occupationCount(units) > 0 || z.ownerId === localPlayerId || !z.ownerId) {
          onMove({
            type: 'move',
            playerId: localPlayerId,
            fromZoneId: moveFrom,
            toZoneId: id,
            units,
          })
        }
        setMoveFrom(null)
      } else {
        if (z.ownerId === localPlayerId && hasUnits(z.units)) setMoveFrom(id)
        else setMoveFrom(null)
      }
      return
    }
    if (state.phase === 'ranged' && !state.rangedUsed) {
      if (moveFrom == null) {
        if (z.ownerId === localPlayerId) setMoveFrom(id)
      } else if (areAdjacent(state.adj, moveFrom, id)) {
        onMove({
          type: 'ranged',
          playerId: localPlayerId,
          fromZoneId: moveFrom,
          toZoneId: id,
        })
        setMoveFrom(null)
      } else {
        setMoveFrom(z.ownerId === localPlayerId ? id : null)
      }
    }
  }

  const buy = (unit: WarfrontUnit) => {
    if (!myTurn || state.phase !== 'buy' || selected == null) return
    onMove({ type: 'buy', playerId: localPlayerId, unit, zoneId: selected, count: 1 })
  }

  const viewW = 1 / cam.zoom
  const viewH = 1 / cam.zoom
  const viewLeft = cam.x - viewW / 2
  const viewTop = cam.y - viewH / 2

  const transform = useMemo(() => {
    const tx = 50 - cam.x * 100
    const ty = 50 - cam.y * 100
    return `translate(${tx}%, ${ty}%) scale(${cam.zoom})`
  }, [cam])

  const turnName =
    state.players.find((p) => p.id === state.turnPlayerId)?.name ?? '—'

  return (
    <div className={`wf-root${myTurn ? ' is-my-turn' : ''}${state.phase === 'gameEnd' ? ' is-victory' : ''}`}>
      <header className="wf-header">
        <div>
          <h1>Warfront</h1>
          <p className="wf-sub">
            {state.config.theater === 'sea' ? 'Sea' : 'Land'} ·{' '}
            {state.config.align === 'teams' ? '2v2' : 'FFA'} · Round {state.round} · {state.phase}
          </p>
        </div>
        <div className="wf-status">
          <strong>{turnName}</strong>
          <span>{state.lastMessage}</span>
        </div>
        <div className="wf-header-actions">
          {onNewMatch ? (
            <button type="button" className="wf-btn" onClick={onNewMatch}>
              New match
            </button>
          ) : null}
          {onLeave ? (
            <button type="button" className="wf-btn ghost" onClick={onLeave}>
              Leave
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="wf-error">{error}</p> : null}

      <div className="wf-body">
        <div className="wf-side">
          <h2>Commanders</h2>
          <ul className="wf-players">
            {state.players.map((p, i) => (
              <li
                key={p.id}
                style={{ borderLeftColor: SIDE_COLORS[i % SIDE_COLORS.length] }}
                className={p.id === state.turnPlayerId ? 'active' : ''}
              >
                <span>
                  {p.name}
                  {p.isComputer ? ' (bot)' : ''}
                  {p.teamId ? ` · ${p.teamId}` : ''}
                </span>
                <span>
                  {p.pp} PP · {p.vp} VP
                </span>
              </li>
            ))}
          </ul>

          <div className="wf-cam-tools">
            <button type="button" className="wf-btn" onClick={() => setCam((c) => ({ ...c, zoom: Math.min(2.5, c.zoom + 0.2) }))}>
              Zoom +
            </button>
            <button type="button" className="wf-btn" onClick={() => setCam((c) => ({ ...c, zoom: Math.max(0.55, c.zoom - 0.2) }))}>
              Zoom −
            </button>
            <button type="button" className="wf-btn" onClick={() => recenter(home)}>
              Home
            </button>
            <button type="button" className="wf-btn" onClick={() => recenter()} disabled={selected == null}>
              Selection
            </button>
          </div>

          <div className="wf-minimap" aria-label="Minimap">
            <svg viewBox="0 0 1 1" className="wf-minimap-svg">
              {state.layout.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={0.028}
                  fill={ownerColor(state.zones[i]!.ownerId)}
                  stroke={state.zones[i]!.facility ? '#d4b56a' : 'transparent'}
                  strokeWidth={0.01}
                  onClick={() => {
                    setCam((c) => ({ ...c, x: p.x, y: p.y }))
                    setSelected(i)
                  }}
                />
              ))}
              <rect
                x={viewLeft}
                y={viewTop}
                width={viewW}
                height={viewH}
                fill="none"
                stroke="#d4b56a"
                strokeWidth={0.012}
              />
            </svg>
          </div>

          {myTurn && state.phase === 'buy' ? (
            <div className="wf-panel">
              <h3>Buy → place at {facName}</h3>
              <p className="wf-hint">Select owned {facName.toLowerCase()} on map, then buy.</p>
              <div className="wf-buy-grid">
                {catalog.map((d) => (
                  <button
                    key={d.unit}
                    type="button"
                    className="wf-btn"
                    disabled={!local || local.pp < d.cost || selected == null}
                    onClick={() => buy(d.unit)}
                  >
                    {d.label} ({d.cost})
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="wf-btn primary"
                onClick={() => onMove({ type: 'skipBuy', playerId: localPlayerId })}
              >
                Done buying
              </button>
            </div>
          ) : null}

          {myTurn && state.phase === 'ranged' ? (
            <div className="wf-panel">
              <h3>Ranged</h3>
              <p className="wf-hint">Select your artillery/carrier zone, then an adjacent enemy.</p>
              <button
                type="button"
                className="wf-btn primary"
                onClick={() => onMove({ type: 'skipRanged', playerId: localPlayerId })}
              >
                Skip ranged
              </button>
            </div>
          ) : null}

          {myTurn && state.phase === 'move' ? (
            <div className="wf-panel">
              <h3>Move / attack</h3>
              <p className="wf-hint">
                {moveFrom == null
                  ? 'Select your stack, then an adjacent zone.'
                  : `From zone ${moveFrom} — pick destination.`}
              </p>
              <button
                type="button"
                className="wf-btn"
                onClick={() => onMove({ type: 'skipMove', playerId: localPlayerId })}
                disabled={state.moved}
              >
                Hold position
              </button>
              <button
                type="button"
                className="wf-btn primary"
                onClick={() => onMove({ type: 'endTurn', playerId: localPlayerId })}
              >
                End turn
              </button>
            </div>
          ) : null}

          {selected != null ? (
            <div className="wf-panel">
              <h3>
                Zone {selected}
                {state.zones[selected]!.facility ? ` · ${facName}` : ''}
              </h3>
              <p>
                Owner:{' '}
                {state.players.find((p) => p.id === state.zones[selected]!.ownerId)?.name ??
                  'Neutral'}
              </p>
              <p>
                Stack {stackCount(state.zones[selected]!.units)} · Atk{' '}
                {estimateAtk(state.zones[selected]!.units)} · Def{' '}
                {estimateDef(state.zones[selected]!.units)}
              </p>
              <ul className="wf-stack">
                {Object.entries(state.zones[selected]!.units).map(([u, n]) =>
                  n ? (
                    <li key={u}>
                      {u}: {n}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ) : null}

          {state.phase === 'gameEnd' ? (
            <div className="wf-panel victory">
              <h3>Victory</h3>
              <p>{state.lastMessage}</p>
            </div>
          ) : null}
        </div>

        <div
          className="wf-map-wrap"
          ref={mapRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="wf-map-world" style={{ transform, transformOrigin: 'center center' }}>
            <svg className="wf-edges" viewBox="0 0 1 1" preserveAspectRatio="none">
              {state.adj.map((nbrs, a) =>
                nbrs
                  .filter((b) => b > a)
                  .map((b) => (
                    <line
                      key={`${a}-${b}`}
                      x1={state.layout[a]!.x}
                      y1={state.layout[a]!.y}
                      x2={state.layout[b]!.x}
                      y2={state.layout[b]!.y}
                      stroke="rgba(212,181,106,0.28)"
                      strokeWidth={0.004}
                    />
                  )),
              )}
            </svg>
            {state.layout.map((p, i) => {
              const z = state.zones[i]!
              const n = stackCount(z.units)
              const isSel = selected === i
              const isFrom = moveFrom === i
              return (
                <button
                  key={i}
                  type="button"
                  className={`wf-zone${isSel ? ' sel' : ''}${isFrom ? ' from' : ''}${z.facility ? ' fac' : ''}`}
                  style={{
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`,
                    background: ownerColor(z.ownerId),
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectZone(i)
                  }}
                  title={`Zone ${i}`}
                >
                  <span className="wf-zone-id">{i}</span>
                  {z.facility ? <span className="wf-fac-mark">◆</span> : null}
                  {n > 0 ? <span className="wf-stack-dot">{n}</span> : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
