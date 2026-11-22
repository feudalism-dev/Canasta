import { BF_SHIP_SRC, shipFootprint, type BfSpriteShip } from './battlefleetSprites'

type Props = {
  ships: BfSpriteShip[]
}

/**
 * Footprint container spans exact occupied cells. Visible art is inset and
 * proportionally contained (not stretched) so ocean remains around the hull.
 * Horizontal ships rotate via an inner wrapper sized to the swapped footprint.
 */
export function BattleFleetShipLayer({ ships }: Props) {
  return (
    <div className="bf-ship-layer" aria-hidden>
      {ships.map((ship) => {
        const { x0, y0, w, h, orient } = shipFootprint(ship.cells)
        const src = ship.sunk
          ? BF_SHIP_SRC[ship.kind].sunk
          : BF_SHIP_SRC[ship.kind].intact
        const cls = [
          'bf-ship-slot',
          orient === 'H' ? 'is-h' : 'is-v',
          ship.sunk ? 'is-sunk' : '',
          ship.ghost ? 'is-ghost' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const sw = `calc(${w} * var(--bf-cell) + ${w - 1} * 1px)`
        const sh = `calc(${h} * var(--bf-cell) + ${h - 1} * 1px)`
        const art = (
          <div className="bf-ship-art">
            <img src={src} alt="" draggable={false} />
          </div>
        )
        return (
          <div
            key={ship.key}
            className={cls}
            style={{
              left: `calc(${x0} * (var(--bf-cell) + 1px))`,
              top: `calc(${y0} * (var(--bf-cell) + 1px))`,
              width: sw,
              height: sh,
              ['--bf-sw' as string]: sw,
              ['--bf-sh' as string]: sh,
            }}
          >
            {orient === 'H' ? <div className="bf-ship-rot">{art}</div> : art}
          </div>
        )
      })}
    </div>
  )
}
