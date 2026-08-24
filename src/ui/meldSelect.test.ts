import { describe, expect, it } from 'vitest'
import { makeCard } from '../core/cards'
import { variantConfig } from '../core/variants'
import { addCardToGroups } from './meldSelect'

describe('meldSelect', () => {
  const samba = variantConfig('samba', 2)
  const classic = variantConfig('canasta', 2)

  it('groups same-rank cards for classic', () => {
    const c7a = makeCard(0, 'H', '7', 0)
    const c7b = makeCard(0, 'D', '7', 1)
    const c7c = makeCard(0, 'S', '7', 2)
    const byId = new Map([c7a, c7b, c7c].map((c) => [c.id, c]))
    let groups = addCardToGroups([], c7a, byId, classic)
    groups = addCardToGroups(groups, c7b, byId, classic)
    groups = addCardToGroups(groups, c7c, byId, classic)
    expect(groups).toEqual([[c7a.id, c7b.id, c7c.id]])
  })

  it('groups consecutive same-suit cards for samba', () => {
    const c6 = makeCard(0, 'S', '6', 0)
    const c7 = makeCard(0, 'S', '7', 1)
    const c8 = makeCard(0, 'S', '8', 2)
    const byId = new Map([c6, c7, c8].map((c) => [c.id, c]))
    let groups = addCardToGroups([], c6, byId, samba)
    groups = addCardToGroups(groups, c7, byId, samba)
    groups = addCardToGroups(groups, c8, byId, samba)
    expect(groups).toEqual([[c6.id, c7.id, c8.id]])
  })

  it('starts a new group when suit or rank does not continue', () => {
    const c6 = makeCard(0, 'S', '6', 0)
    const c7 = makeCard(0, 'H', '7', 1)
    const byId = new Map([c6, c7].map((c) => [c.id, c]))
    let groups = addCardToGroups([], c6, byId, samba)
    groups = addCardToGroups(groups, c7, byId, samba)
    expect(groups).toEqual([[c6.id], [c7.id]])
  })
})
