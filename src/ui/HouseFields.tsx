import type { HouseRules } from '../core/types'

type Props = {
  house: HouseRules
  onChange: (house: HouseRules) => void
}

export function HandAndFootHouseFields({ house, onChange }: Props) {
  return (
    <>
      <label>
        Books to go out
        <select
          value={`${house.goingOutClean}-${house.goingOutDirty}`}
          onChange={(e) => {
            const v = e.target.value
            if (v === '2-2') onChange({ ...house, goingOutClean: 2, goingOutDirty: 2 })
            else onChange({ ...house, goingOutClean: 1, goingOutDirty: 1 })
          }}
        >
          <option value="1-1">1 clean + 1 dirty</option>
          <option value="2-2">2 clean + 2 dirty</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={house.wildBooksAllowed}
          onChange={(e) => onChange({ ...house, wildBooksAllowed: e.target.checked })}
        />
        Allow wild books (+1500)
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={house.addToClosedBooks}
          onChange={(e) => onChange({ ...house, addToClosedBooks: e.target.checked })}
        />
        Allow adding to closed books
      </label>
    </>
  )
}
