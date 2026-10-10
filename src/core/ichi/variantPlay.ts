import { faceColor, faceKind, palaceRank, sortIchiHand } from './deck'
import { scoreShedHand } from './score'
import { cloneIchi, drawCards, nextIndex, topCard } from './state'
import type { IchiCard, IchiColor, IchiMove, IchiState } from './types'

export type ApplyResult = { ok: true; state: IchiState } | { ok: false; error: string }

function side(state: IchiState) {
  return state.flipSide
}

function pileColor(state: IchiState, pile: 0 | 1): IchiColor {
  return pile === 1 ? state.currentColorB : state.currentColor
}

function setPileColor(state: IchiState, pile: 0 | 1, color: IchiColor): void {
  if (pile === 1) state.currentColorB = color
  else state.currentColor = color
}

function pushPile(state: IchiState, pile: 0 | 1, card: IchiCard): void {
  if (pile === 1) state.discardB.push(card)
  else state.discard.push(card)
}

function matchesPile(state: IchiState, card: IchiCard, pile: 0 | 1): boolean {
  const s = side(state)
  const kind = faceKind(card, s)
  const color = faceColor(card, s)
  if (kind === 'wild' || kind === 'wdf' || kind === 'flip' || kind === '8') return true
  if (color === pileColor(state, pile)) return true
  const top = topCard(state, pile)
  if (top && faceKind(top, s) === kind) return true
  return false
}

/** Crazy Eights: match color/number; 8 and wild name color. */
export function legalEights(state: IchiState, playerIndex: number): IchiCard[] {
  if (state.phase !== 'play' || playerIndex !== state.current) return []
  const pl = state.players[playerIndex]!
  if (state.drawnPlayableId) return pl.hand.filter((c) => c.id === state.drawnPlayableId)
  return pl.hand.filter((c) => matchesPile(state, c, 0))
}

export function applyEights(state: IchiState, move: IchiMove): ApplyResult {
  const next = cloneIchi(state)
  if (move.t === 'chooseColor') {
    if (next.phase !== 'colorPick' || next.colorPicker == null) return { ok: false, error: 'Not choosing' }
    next.currentColor = move.color
    next.colorPicker = null
    next.phase = 'play'
    next.current = nextIndex(next, next.current)
    next.lastMessage = `Color is ${move.color}.`
    return { ok: true, state: next }
  }
  if (move.t === 'draw') {
    if (next.phase !== 'play') return { ok: false, error: 'Not play' }
    if (legalEights(next, next.current).length) return { ok: false, error: 'You can play' }
    const me = next.current
    const drawn = drawCards(next, me, 1)
    if (!drawn[0]) return { ok: false, error: 'Empty stock' }
    if (matchesPile(next, drawn[0], 0)) {
      next.drawnPlayableId = drawn[0].id
      next.lastMessage = `${next.players[me]!.name} drew a playable card.`
      return { ok: true, state: next }
    }
    next.current = nextIndex(next, me)
    next.lastMessage = `${next.players[me]!.name} draws.`
    return { ok: true, state: next }
  }
  if (move.t === 'pass') {
    if (!next.drawnPlayableId) return { ok: false, error: 'Nothing to pass' }
    const me = next.current
    next.drawnPlayableId = null
    next.current = nextIndex(next, me)
    return { ok: true, state: next }
  }
  if (move.t !== 'play') return { ok: false, error: 'Not an eights move' }
  if (next.phase !== 'play') return { ok: false, error: 'Not play' }
  const me = next.current
  const pl = next.players[me]!
  const card = pl.hand.find((c) => c.id === move.cardId)
  if (!card || !legalEights(next, me).some((c) => c.id === card.id)) {
    return { ok: false, error: 'Illegal play' }
  }
  pl.hand = sortIchiHand(pl.hand.filter((c) => c.id !== card.id))
  next.discard.push(card)
  next.drawnPlayableId = null
  if (card.color) next.currentColor = card.color
  next.log.push(`${pl.name} played ${card.kind}${card.color ?? ''}.`)
  if (pl.hand.length === 0) {
    scoreShedHand(next, me)
    return { ok: true, state: next }
  }
  if (card.kind === '8' || card.kind === 'wild' || card.kind === 'wdf') {
    next.phase = 'colorPick'
    next.colorPicker = me
    next.current = me
    next.lastMessage = `${pl.name} names a color.`
    return { ok: true, state: next }
  }
  next.current = nextIndex(next, me)
  next.phase = 'play'
  next.lastMessage = next.log[next.log.length - 1]!
  return { ok: true, state: next }
}

/** Twin Piles (DOS-style). */
export function legalDos(state: IchiState, playerIndex: number, pile?: 0 | 1): IchiCard[] {
  if (state.phase !== 'play' || playerIndex !== state.current) return []
  const pl = state.players[playerIndex]!
  const piles: (0 | 1)[] = pile == null ? [0, 1] : [pile]
  return pl.hand.filter((c) => piles.some((p) => matchesPile(state, c, p)))
}

export function applyDos(state: IchiState, move: IchiMove): ApplyResult {
  const next = cloneIchi(state)
  if (move.t === 'chooseColor') {
    if (next.phase !== 'colorPick' || next.colorPicker == null) return { ok: false, error: 'Not choosing' }
    const pile = next.colorPickPile ?? 0
    setPileColor(next, pile, move.color)
    next.colorPicker = null
    next.colorPickPile = null
    next.phase = 'play'
    next.current = nextIndex(next, next.current)
    next.lastMessage = `Pile ${pile === 0 ? 'A' : 'B'} is ${move.color}.`
    return { ok: true, state: next }
  }
  if (move.t === 'draw') {
    if (legalDos(next, next.current).length) return { ok: false, error: 'You can play' }
    const me = next.current
    drawCards(next, me, 1)
    next.current = nextIndex(next, me)
    next.lastMessage = `${next.players[me]!.name} draws.`
    return { ok: true, state: next }
  }
  if (move.t === 'playTwo') {
    if (next.phase !== 'play') return { ok: false, error: 'Not play' }
    const me = next.current
    const pl = next.players[me]!
    const [aId, bId] = move.cardIds
    const a = pl.hand.find((c) => c.id === aId)
    const b = pl.hand.find((c) => c.id === bId)
    if (!a || !b || a.kind !== b.kind || a.kind === 'wild' || a.kind === 'wdf') {
      return { ok: false, error: 'Need two matching numbers' }
    }
    const pile = move.pile ?? 0
    if (!matchesPile(next, a, 0) && !matchesPile(next, a, 1)) {
      return { ok: false, error: 'Illegal double' }
    }
    // Prefer: one on each pile if both legal; else both on chosen pile
    const bothPiles = matchesPile(next, a, 0) && matchesPile(next, b, 1)
    pl.hand = sortIchiHand(pl.hand.filter((c) => c.id !== aId && c.id !== bId))
    if (bothPiles && move.pile == null) {
      pushPile(next, 0, a)
      pushPile(next, 1, b)
      if (a.color) next.currentColor = a.color
      if (b.color) next.currentColorB = b.color
      next.log.push(`${pl.name} plays double ${a.kind} on both piles.`)
    } else {
      const p = matchesPile(next, a, pile) ? pile : matchesPile(next, a, 0) ? 0 : 1
      pushPile(next, p, a)
      pushPile(next, p, b)
      if (b.color) setPileColor(next, p, b.color)
      next.log.push(`${pl.name} plays double ${a.kind} on pile ${p === 0 ? 'A' : 'B'}.`)
    }
    if (pl.hand.length === 0) {
      scoreShedHand(next, me)
      return { ok: true, state: next }
    }
    next.current = nextIndex(next, me)
    next.lastMessage = next.log[next.log.length - 1]!
    return { ok: true, state: next }
  }
  if (move.t !== 'play') return { ok: false, error: 'Not a Twin Piles move' }
  const me = next.current
  const pl = next.players[me]!
  const card = pl.hand.find((c) => c.id === move.cardId)
  if (!card) return { ok: false, error: 'Card not in hand' }
  const pile: 0 | 1 =
    move.pile ??
    (matchesPile(next, card, 0) ? 0 : matchesPile(next, card, 1) ? 1 : 0)
  if (!matchesPile(next, card, pile)) return { ok: false, error: 'Illegal on that pile' }
  pl.hand = sortIchiHand(pl.hand.filter((c) => c.id !== card.id))
  pushPile(next, pile, card)
  if (card.color) setPileColor(next, pile, card.color)
  next.log.push(`${pl.name} → pile ${pile === 0 ? 'A' : 'B'} (${card.kind}${card.color ?? ''}).`)
  if (pl.hand.length === 0) {
    scoreShedHand(next, me)
    return { ok: true, state: next }
  }
  if (card.kind === '8' || card.kind === 'wild' || card.kind === 'wdf') {
    next.phase = 'colorPick'
    next.colorPicker = me
    next.colorPickPile = pile
    next.current = me
    next.lastMessage = `${pl.name} names color for pile ${pile === 0 ? 'A' : 'B'}.`
    return { ok: true, state: next }
  }
  next.current = nextIndex(next, me)
  next.lastMessage = next.log[next.log.length - 1]!
  return { ok: true, state: next }
}

/** Switch: stacking 2s; actions as labeled. */
export function legalSwitch(state: IchiState, playerIndex: number): IchiCard[] {
  if (state.phase !== 'play' || playerIndex !== state.current) return []
  const pl = state.players[playerIndex]!
  if (state.pendingDraw > 0) {
    return pl.hand.filter((c) => c.kind === '2' || c.kind === 'draw2' || c.kind === 'wdf')
  }
  return pl.hand.filter((c) => matchesPile(state, c, 0))
}

export function applySwitch(state: IchiState, move: IchiMove): ApplyResult {
  const next = cloneIchi(state)
  if (move.t === 'chooseColor') {
    if (next.phase !== 'colorPick' || next.colorPicker == null) return { ok: false, error: 'Not choosing' }
    next.currentColor = move.color
    next.colorPicker = null
    next.phase = 'play'
    next.current = nextIndex(next, next.current)
    next.lastMessage = `Color is ${move.color}.`
    return { ok: true, state: next }
  }
  if (move.t === 'draw') {
    const me = next.current
    if (next.pendingDraw > 0) {
      drawCards(next, me, next.pendingDraw)
      next.log.push(`${next.players[me]!.name} draws ${next.pendingDraw}.`)
      next.pendingDraw = 0
      next.current = nextIndex(next, me)
      next.lastMessage = next.log[next.log.length - 1]!
      return { ok: true, state: next }
    }
    if (legalSwitch(next, me).length) return { ok: false, error: 'You can play' }
    drawCards(next, me, 1)
    next.current = nextIndex(next, me)
    next.lastMessage = `${next.players[me]!.name} draws.`
    return { ok: true, state: next }
  }
  if (move.t !== 'play') return { ok: false, error: 'Not a Switch move' }
  const me = next.current
  const pl = next.players[me]!
  const card = pl.hand.find((c) => c.id === move.cardId)
  if (!card || !legalSwitch(next, me).some((c) => c.id === card.id)) {
    return { ok: false, error: 'Illegal play' }
  }
  pl.hand = sortIchiHand(pl.hand.filter((c) => c.id !== card.id))
  next.discard.push(card)
  if (card.color) next.currentColor = card.color
  next.log.push(`${pl.name} played ${card.kind}${card.color ?? ''}.`)
  if (pl.hand.length === 0) {
    scoreShedHand(next, me)
    return { ok: true, state: next }
  }
  if (card.kind === '2' || card.kind === 'draw2') {
    next.pendingDraw += 2
    next.current = nextIndex(next, me)
    next.lastMessage = `Draw stack ${next.pendingDraw}.`
    return { ok: true, state: next }
  }
  if (card.kind === 'wdf') {
    next.pendingDraw += 4
    next.current = nextIndex(next, me)
    next.lastMessage = `Draw stack ${next.pendingDraw}.`
    return { ok: true, state: next }
  }
  if (next.pendingDraw > 0) {
    // played a non-stacker while debt pending — shouldn't happen via legal
    next.pendingDraw = 0
  }
  if (card.kind === 'wild' || card.kind === '8') {
    next.phase = 'colorPick'
    next.colorPicker = me
    next.current = me
    return { ok: true, state: next }
  }
  if (card.kind === 'skip') {
    next.current = nextIndex(next, me, 2)
    next.lastMessage = 'Skipped.'
    return { ok: true, state: next }
  }
  if (card.kind === 'reverse') {
    if (next.players.length === 2) next.current = me
    else {
      next.direction = next.direction === 1 ? -1 : 1
      next.current = nextIndex(next, me)
    }
    next.lastMessage = 'Reversed.'
    return { ok: true, state: next }
  }
  next.current = nextIndex(next, me)
  next.lastMessage = next.log[next.log.length - 1]!
  return { ok: true, state: next }
}

function palaceZone(pl: IchiState['players'][0]): 'hand' | 'up' | 'down' {
  if (pl.hand.length) return 'hand'
  if ((pl.palaceUp ?? []).length) return 'up'
  return 'down'
}

function palaceCards(pl: IchiState['players'][0]): IchiCard[] {
  const z = palaceZone(pl)
  if (z === 'hand') return pl.hand
  if (z === 'up') return pl.palaceUp ?? []
  return pl.palaceDown ?? []
}

export function legalPalace(state: IchiState, playerIndex: number): IchiCard[] {
  if (state.phase !== 'play' || playerIndex !== state.current) return []
  const pl = state.players[playerIndex]!
  const zone = palaceZone(pl)
  const cards = palaceCards(pl)
  const top = topCard(state)
  if (!top) return [...cards]
  const topR = palaceRank(top)
  // Face-down: any single card is "legal" (blind)
  if (zone === 'down') return cards.slice(0, 1)
  return cards.filter((c) => {
    if (c.kind === '2' || c.kind === 'wild' || c.kind === 'wdf') return true
    return palaceRank(c) >= topR || top.kind === '2'
  })
}

export function applyPalace(state: IchiState, move: IchiMove): ApplyResult {
  const next = cloneIchi(state)
  if (move.t === 'takePile') {
    if (next.phase !== 'play') return { ok: false, error: 'Not play' }
    const me = next.current
    const pl = next.players[me]!
    if (legalPalace(next, me).length) return { ok: false, error: 'You can play' }
    pl.hand = sortIchiHand([...pl.hand, ...next.discard])
    next.discard = []
    next.log.push(`${pl.name} takes the pile.`)
    next.current = nextIndex(next, me)
    next.lastMessage = next.log[next.log.length - 1]!
    return { ok: true, state: next }
  }
  if (move.t !== 'play') return { ok: false, error: 'Not a Palace move' }
  const me = next.current
  const pl = next.players[me]!
  const zone = palaceZone(pl)
  const cards = palaceCards(pl)
  const card = cards.find((c) => c.id === move.cardId)
  if (!card) return { ok: false, error: 'Card not available' }
  if (zone !== 'down' && !legalPalace(next, me).some((c) => c.id === card.id)) {
    return { ok: false, error: 'Illegal play' }
  }
  if (zone === 'hand') pl.hand = sortIchiHand(pl.hand.filter((c) => c.id !== card.id))
  else if (zone === 'up') pl.palaceUp = (pl.palaceUp ?? []).filter((c) => c.id !== card.id)
  else pl.palaceDown = (pl.palaceDown ?? []).filter((c) => c.id !== card.id)

  next.discard.push(card)
  next.log.push(`${pl.name} played ${card.kind}${card.color ?? ''} (${zone}).`)

  // 2 resets / wild burns
  if (card.kind === 'wild' || card.kind === 'wdf') {
    next.discard = []
    next.log.push('Pile burned.')
    // same player continues
  } else if (card.kind === '2') {
    // reset — any card can follow; turn passes
    next.current = nextIndex(next, me)
  } else {
    next.current = nextIndex(next, me)
  }

  const empty =
    pl.hand.length === 0 &&
    (pl.palaceUp ?? []).length === 0 &&
    (pl.palaceDown ?? []).length === 0
  if (empty) {
    scoreShedHand(next, me)
    return { ok: true, state: next }
  }
  next.lastMessage = next.log[next.log.length - 1]!
  return { ok: true, state: next }
}

/** Ichi Flip — uses dark/light faces. */
export function legalFlip(state: IchiState, playerIndex: number): IchiCard[] {
  if (state.phase !== 'play' || playerIndex !== state.current) return []
  const pl = state.players[playerIndex]!
  const s = side(state)
  const top = topCard(state)
  const hasColor = pl.hand.some((c) => faceColor(c, s) === state.currentColor)
  return pl.hand.filter((c) => {
    const k = faceKind(c, s)
    const col = faceColor(c, s)
    if (k === 'flip' || k === 'wild') return true
    if (k === 'wdf') return !hasColor
    if (col === state.currentColor) return true
    if (top && faceKind(top, s) === k) return true
    return false
  })
}

export function applyFlip(state: IchiState, move: IchiMove): ApplyResult {
  const next = cloneIchi(state)
  const s = side(next)
  if (move.t === 'chooseColor') {
    if (next.phase !== 'colorPick' || next.colorPicker == null) return { ok: false, error: 'Not choosing' }
    next.currentColor = move.color
    next.colorPicker = null
    next.phase = 'play'
    next.current = nextIndex(next, next.current)
    next.lastMessage = `Color is ${move.color}.`
    return { ok: true, state: next }
  }
  if (move.t === 'draw') {
    if (legalFlip(next, next.current).length) return { ok: false, error: 'You can play' }
    const me = next.current
    drawCards(next, me, 1)
    next.current = nextIndex(next, me)
    next.lastMessage = `${next.players[me]!.name} draws.`
    return { ok: true, state: next }
  }
  if (move.t !== 'play') return { ok: false, error: 'Not a Flip move' }
  const me = next.current
  const pl = next.players[me]!
  const card = pl.hand.find((c) => c.id === move.cardId)
  if (!card || !legalFlip(next, me).some((c) => c.id === card.id)) {
    return { ok: false, error: 'Illegal play' }
  }
  const k = faceKind(card, s)
  const col = faceColor(card, s)
  pl.hand = sortIchiHand(
    pl.hand.filter((c) => c.id !== card.id),
    s,
  )
  next.discard.push(card)
  if (col) next.currentColor = col
  next.log.push(`${pl.name} played ${k}${col ?? ''} (${s}).`)
  if (pl.hand.length === 0) {
    scoreShedHand(next, me, s)
    return { ok: true, state: next }
  }
  if (k === 'flip') {
    next.flipSide = next.flipSide === 'light' ? 'dark' : 'light'
    next.log.push(`Table flips to ${next.flipSide}.`)
    const top = topCard(next)
    if (top) {
      const nc = faceColor(top, next.flipSide)
      if (nc) next.currentColor = nc
    }
    next.current = nextIndex(next, me)
    next.lastMessage = next.log[next.log.length - 1]!
    return { ok: true, state: next }
  }
  if (k === 'wild' || k === 'wdf') {
    next.phase = 'colorPick'
    next.colorPicker = me
    next.current = me
    if (k === 'wdf') {
      next.wdfPlayer = me
      next.challengeTarget = nextIndex(next, me)
      next.colorBeforeWdf = next.currentColor
      next.wdfLegal = true
    }
    return { ok: true, state: next }
  }
  if (k === 'skip') {
    next.current = nextIndex(next, me, 2)
    return { ok: true, state: next }
  }
  if (k === 'reverse') {
    if (next.players.length === 2) next.current = me
    else {
      next.direction = next.direction === 1 ? -1 : 1
      next.current = nextIndex(next, me)
    }
    return { ok: true, state: next }
  }
  if (k === 'draw2') {
    const victim = nextIndex(next, me)
    drawCards(next, victim, next.flipSide === 'dark' ? 5 : 2)
    next.current = nextIndex(next, me, 2)
    return { ok: true, state: next }
  }
  next.current = nextIndex(next, me)
  next.lastMessage = next.log[next.log.length - 1]!
  return { ok: true, state: next }
}
