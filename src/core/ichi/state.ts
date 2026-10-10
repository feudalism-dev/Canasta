import {
  deckForVariant,
  faceColor,
  faceKind,
  isNumber,
  isWild,
  shuffleDeck,
  sortIchiHand,
} from './deck'
import { clampIchiPlayerCount, ichiConfig, ichiDealCount, ichiVariantLabel } from './variants'
import type { IchiCard, IchiPlayer, IchiState, IchiVariant } from './types'

export function cloneIchi(state: IchiState): IchiState {
  return structuredClone(state)
}

export function currentPlayer(state: IchiState): IchiPlayer {
  return state.players[state.current]!
}

export function nextIndex(state: IchiState, from = state.current, steps = 1): number {
  const n = state.players.length
  let i = from
  for (let s = 0; s < steps; s++) {
    i = (i + state.direction + n * 4) % n
  }
  return i
}

function ensureStock(state: IchiState): void {
  if (state.stock.length > 0) return
  const pile = state.discard
  if (pile.length <= 1) {
    // DOS: also try pile B
    if (state.config.variant === 'dos' && state.discardB.length > 1) {
      const top = state.discardB[state.discardB.length - 1]!
      const rest = state.discardB.slice(0, -1)
      state.discardB = [top]
      state.stock = shuffleDeck(rest, Date.now() % 1e9)
      state.log.push('Stock reshuffled from pile B.')
      return
    }
    return
  }
  const top = pile[pile.length - 1]!
  const rest = pile.slice(0, -1)
  state.discard = [top]
  state.stock = shuffleDeck(rest, Date.now() % 1e9)
  state.log.push('Stock reshuffled from discard.')
}

export function drawCards(state: IchiState, playerIndex: number, count: number): IchiCard[] {
  const pl = state.players[playerIndex]!
  const taken: IchiCard[] = []
  const side = state.flipSide
  for (let i = 0; i < count; i++) {
    ensureStock(state)
    const c = state.stock[0]
    if (!c) break
    state.stock = state.stock.slice(1)
    taken.push(c)
  }
  pl.hand = sortIchiHand([...pl.hand, ...taken], side)
  return taken
}

function emptyExtras(n: number): Pick<
  IchiState,
  | 'discardB'
  | 'currentColorB'
  | 'pendingDraw'
  | 'colorPickPile'
  | 'flipSide'
  | 'colorPicker'
  | 'challengeTarget'
  | 'wdfPlayer'
  | 'colorBeforeWdf'
  | 'ichiPending'
  | 'ichiCalled'
  | 'wdfLegal'
  | 'drawnPlayableId'
> {
  return {
    discardB: [],
    currentColorB: 'R',
    pendingDraw: 0,
    colorPickPile: null,
    flipSide: 'light',
    colorPicker: null,
    challengeTarget: null,
    wdfPlayer: null,
    colorBeforeWdf: null,
    ichiPending: null,
    ichiCalled: Array.from({ length: n }, () => false),
    wdfLegal: null,
    drawnPlayableId: null,
  }
}

export function createIchiMatch(
  names: string[],
  computers: boolean[],
  variant: IchiVariant = 'classic',
  seed = Date.now(),
): IchiState {
  const n = clampIchiPlayerCount(names.length)
  const config = ichiConfig(variant, n)
  const useNames = names.slice(0, n)
  while (useNames.length < n) useNames.push(`P${useNames.length + 1}`)
  const useComputers = computers.slice(0, n)
  while (useComputers.length < n) useComputers.push(true)

  const players: IchiPlayer[] = useNames.map((name, i) => ({
    id: `p${i}`,
    name,
    seat: i,
    isComputer: !!useComputers[i],
    hand: [],
    score: 0,
    palaceDown: [],
    palaceUp: [],
    handsWon: 0,
  }))

  return dealIchiHand(
    {
      config,
      players,
      phase: 'play',
      current: 0,
      round: 1,
      direction: 1,
      stock: [],
      discard: [],
      currentColor: 'R',
      winnerId: null,
      log: [],
      lastHandNote: null,
      lastHandScores: null,
      lastMessage: null,
      ...emptyExtras(n),
    },
    seed,
  )
}

function pickStarter(deck: IchiCard[], side: 'light' | 'dark'): {
  starter: IchiCard | null
  rest: IchiCard[]
  buried: IchiCard[]
} {
  let rest = deck
  const buried: IchiCard[] = []
  let starter: IchiCard | null = null
  while (rest.length) {
    const c = rest[0]!
    rest = rest.slice(1)
    if (isNumber(c, side) && faceColor(c, side)) {
      starter = c
      break
    }
    buried.push(c)
  }
  if (!starter) {
    const c = buried.pop() ?? rest[0]
    if (c) {
      starter = c
      if (rest[0] === c) rest = rest.slice(1)
    }
  }
  return { starter, rest, buried }
}

export function dealIchiHand(state: IchiState, seed: number): IchiState {
  const next = cloneIchi(state)
  const n = next.players.length
  const v = next.config.variant
  const side: 'light' | 'dark' = 'light'
  Object.assign(next, emptyExtras(n))
  next.flipSide = 'light'
  next.direction = 1
  next.phase = 'play'
  next.winnerId = null
  next.lastHandNote = null
  next.lastHandScores = null
  next.lastMessage = null

  for (const pl of next.players) {
    pl.hand = []
    pl.palaceDown = []
    pl.palaceUp = []
  }

  let deck = shuffleDeck(deckForVariant(v), seed)
  const label = ichiVariantLabel(v)

  if (v === 'palace') {
    for (let p = 0; p < n; p++) {
      for (let i = 0; i < 3; i++) {
        const c = deck[0]
        if (!c) break
        deck = deck.slice(1)
        next.players[p]!.palaceDown!.push(c)
      }
      for (let i = 0; i < 3; i++) {
        const c = deck[0]
        if (!c) break
        deck = deck.slice(1)
        next.players[p]!.palaceUp!.push(c)
      }
      for (let i = 0; i < 3; i++) {
        const c = deck[0]
        if (!c) break
        deck = deck.slice(1)
        next.players[p]!.hand.push(c)
      }
      next.players[p]!.hand = sortIchiHand(next.players[p]!.hand)
    }
    const { starter, rest, buried } = pickStarter(deck, side)
    next.stock = [...rest, ...buried]
    next.discard = starter ? [starter] : []
    next.currentColor = (starter && faceColor(starter, side)) || 'R'
    next.current = 0
    next.log = [
      `Hand ${next.round} — ${label}. Play equal or higher. ${next.players[0]!.name} leads.`,
    ]
    next.lastMessage = next.log[0]!
    return next
  }

  const dealN = ichiDealCount(v)
  for (let c = 0; c < dealN; c++) {
    for (let p = 0; p < n; p++) {
      const card = deck[0]
      if (!card) break
      deck = deck.slice(1)
      next.players[p]!.hand.push(card)
    }
  }
  for (const pl of next.players) pl.hand = sortIchiHand(pl.hand, side)

  const { starter, rest, buried } = pickStarter(deck, side)
  next.stock = [...rest, ...buried]
  next.discard = starter ? [starter] : []
  next.currentColor = (starter && faceColor(starter, side)) || 'R'

  if (v === 'dos') {
    const second = pickStarter(next.stock, side)
    next.stock = [...second.rest, ...second.buried]
    next.discardB = second.starter ? [second.starter] : []
    next.currentColorB = (second.starter && faceColor(second.starter, side)) || 'Y'
  }

  if (starter && isWild(starter, side)) {
    next.phase = 'colorPick'
    next.colorPicker = 0
    next.colorPickPile = 0
  }

  next.current = 0
  next.log = [
    `Hand ${next.round} — ${label}. ${next.players[0]!.name} leads.`,
  ]
  next.lastMessage = next.log[0]!
  return next
}

export function dealNextIchiRound(prev: IchiState, seed = Date.now()): IchiState {
  const base = cloneIchi(prev)
  base.round = prev.round + 1
  const dealt = dealIchiHand(base, seed)
  dealt.current = prev.round % dealt.players.length
  if (dealt.phase === 'colorPick') dealt.colorPicker = dealt.current
  dealt.log[0] =
    `Hand ${dealt.round} — ${ichiVariantLabel(dealt.config.variant)}. ${dealt.players[dealt.current]!.name} leads.`
  dealt.lastMessage = dealt.log[0]!
  return dealt
}

export function withPhysicalSeats(state: IchiState, seats: number[]): IchiState {
  const next = cloneIchi(state)
  next.players = next.players.map((p, i) => ({
    ...p,
    seat: seats[i] ?? p.seat,
  }))
  return next
}

export function topCard(state: IchiState, pile: 0 | 1 = 0): IchiCard | null {
  const d = pile === 1 ? state.discardB : state.discard
  return d[d.length - 1] ?? null
}

export function activeFace(state: IchiState, card: IchiCard) {
  return {
    kind: faceKind(card, state.flipSide),
    color: faceColor(card, state.flipSide),
  }
}
