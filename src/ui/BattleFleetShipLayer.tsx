import { BF_SHIP_SRC, shipFootprint, type BfSpriteShip } from './battlefleetSprites'

type Props = {
  ships: BfSpriteShip[]
}

/**
 * Absolute overlay of ship sprites aligned to the 20×20 grid footprint.
 * Art is bow-up; horizontal ships rotate −90° via an inner wrapper so
 * overflow:hidden on the slot does not clip the pre-transform layout box.
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
            {orient === 'H' ? (
              <div className="bf-ship-rot">
                <img src={src} alt="" draggable={false} />
              </div>
            ) : (
              <img src={src} alt="" draggable={false} />
            )}
          </div>
        )
      })}
    </div>
  )
}
