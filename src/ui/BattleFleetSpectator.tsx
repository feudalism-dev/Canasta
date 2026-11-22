import { useEffect, useMemo, useRef, useState } from 'react'
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
import { BattleFleetShipLayer } from './BattleFleetShipLayer'
import {
  BF_CHROME,
  BF_FX,
  orientFromCells,
  type BfSpriteShip,
} from './battlefleetSprites'
import '../styles/battlefleet.css'

type Props = {
  board: BattleFleetPublicBoard
}

type CellFx = { key: string; kind: 'hit' | 'miss' | 'sunk'; x: number; y: number }

export function BattleFleetSpectator({ board }: Props) {
  const [fx, setFx] = useState<CellFx | null>(null)
  const [msgPulse, setMsgPulse] = useState(false)
  const prevShot = useRef<string>('')
  const prevTurn = useRef<string | null>(null)

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

  const spriteShips = useMemo((): BfSpriteShip[] => {
    return board.sunkShips.map((ship) => ({
      key: `sunk-${ship.sideId}-${ship.kind}`,
      kind: ship.kind,
      cells: ship.cells,
      orient: orientFromCells(ship.cells),
      sunk: true,
    }))
  }, [board.sunkShips])

  useEffect(() => {
    const shot = board.recentShot
    if (!shot) return
    const id = `${shot.x},${shot.y},${shot.result},${board.marks.length}`
    if (id === prevShot.current) return
    prevShot.current = id
    const kind: CellFx['kind'] =
      shot.result === 'miss' ? 'miss' : shot.result === 'sunk' ? 'sunk' : 'hit'
    setFx({ key: cellKey(shot.x, shot.y), kind, x: shot.x, y: shot.y })
    const t = window.setTimeout(() => setFx(null), 620)
    return () => window.clearTimeout(t)
  }, [board.recentShot, board.marks.length])

  useEffect(() => {
    if (board.phase !== 'battle') return
    if (prevTurn.current === board.turnPlayerId) return
    prevTurn.current = board.turnPlayerId
    setMsgPulse(true)
    const t = window.setTimeout(() => setMsgPulse(false), 550)
    return () => window.clearTimeout(t)
  }, [board.turnPlayerId, board.phase])

  const gridModeClass =
    board.mode === 'teams'
      ? 'mode-teams'
      : board.playerCount === 2
        ? 'mode-ffa-2'
        : 'mode-ffa'

  const rootClass = [
    'bf-root',
    'bf-sprites',
    board.phase === 'gameEnd' ? 'is-victory' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      style={{
        ['--bf-corner-url' as string]: `url(${BF_CHROME.corner})`,
        ['--bf-mark-miss' as string]: `url(${BF_FX.ripple})`,
        ['--bf-mark-hit' as string]: `url(${BF_FX.smoke})`,
      }}
    >
      <div className="bf-header">
        <div className="bf-header-brand">
          <img className="bf-chrome-compass" src={BF_CHROME.compass} alt="" />
          <h2>Battle Fleet — Table</h2>
        </div>
        <div className={`bf-msg${msgPulse ? ' bf-msg-pulse' : ''}`}>
          {board.lastMessage}
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
            <h3 className="bf-section-title">
              <img className="bf-chrome-radar" src={BF_CHROME.radar} alt="" />
              Status
            </h3>
            <div className="bf-status-row">
              <span className="bf-pill">{board.phase}</span>
              <span className="bf-pill">{board.mode === 'teams' ? 'Teams' : 'FFA'}</span>
              {board.turnName ? (
                <span className="bf-pill bf-pill-turn">{board.turnName}</span>
              ) : null}
            </div>
          </section>

          <img className="bf-chrome-divider" src={BF_CHROME.divider} alt="" />

          {board.phase === 'gameEnd' && (
            <section className="bf-section">
              <h3 className="bf-section-title">
                <img className="bf-chrome-anchor" src={BF_CHROME.anchor} alt="" />
                Victory
              </h3>
              <div className="bf-victory">
                <strong>
                  {board.winnerTeamId
                    ? `Team ${board.winnerTeamId} victorious`
                    : `${board.players.find((p) => p.id === board.winnerId)?.name ?? 'Winner'} victorious`}
                </strong>
                <div className="bf-victory-sub">Engagement complete</div>
              </div>
            </section>
          )}

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
                    <span className="bf-score-num">{p.score}</span>
                    <span className="bf-score-line">
                      Destroyed {p.shipsSunk} · Afloat {p.shipsLeft}
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
