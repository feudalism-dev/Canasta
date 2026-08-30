import { describe, expect, it } from 'vitest'
import { makeCard } from '../core/cards'
import { variantConfig } from '../core/variants'
import { addCardToGroups, addRankToGroups } from './meldSelect'

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

  it('stages a wild book separately from a complete natural set', () => {
    const k1 = makeCard(0, 'H', 'K', 0)
    const k2 = makeCard(0, 'D', 'K', 1)
    const k3 = makeCard(0, 'S', 'K', 2)
    const w1 = makeCard(0, 'H', '2', 0)
    const w2 = makeCard(0, 'D', '2', 1)
    const w3 = makeCard(0, 'S', '2', 2)
    const byId = new Map([k1, k2, k3, w1, w2, w3].map((c) => [c.id, c]))
    let groups = addCardToGroups([], k1, byId, classic)
    groups = addCardToGroups(groups, k2, byId, classic)
    groups = addCardToGroups(groups, k3, byId, classic)
    groups = addRankToGroups(groups, [w1.id, w2.id, w3.id], byId, classic)
    expect(groups).toEqual([[k1.id, k2.id, k3.id], [w1.id, w2.id, w3.id]])
  })

  it('still gives one wild to an incomplete natural pair', () => {
    const k1 = makeCard(0, 'H', 'K', 0)
    const k2 = makeCard(0, 'D', 'K', 1)
    const w1 = makeCard(0, 'H', '2', 0)
    const w2 = makeCard(0, 'D', '2', 1)
    const w3 = makeCard(0, 'S', '2', 2)
    const byId = new Map([k1, k2, w1, w2, w3].map((c) => [c.id, c]))
    let groups = addCardToGroups([], k1, byId, classic)
    groups = addCardToGroups(groups, k2, byId, classic)
    groups = addRankToGroups(groups, [w1.id, w2.id, w3.id], byId, classic)
    expect(groups).toEqual([[k1.id, k2.id, w1.id], [w2.id, w3.id]])
  })
})
