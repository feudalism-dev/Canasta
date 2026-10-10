import { isNumber, isWild, shuffleIchiDeck, sortIchiHand } from './deck'
import { clampIchiPlayerCount, ichiConfig } from './variants'
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

function topDiscard(state: IchiState): IchiCard | null {
  return state.discard[state.discard.length - 1] ?? null
}

function ensureStock(state: IchiState): void {
  if (state.stock.length > 0) return
  if (state.discard.length <= 1) return
  const top = state.discard[state.discard.length - 1]!
  const rest = state.discard.slice(0, -1)
  state.discard = [top]
  // Reshuffle rest into stock
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = rest[i]!
    rest[i] = rest[j]!
    rest[j] = t
  }
  state.stock = rest
  state.log.push('Stock reshuffled from discard.')
}

export function drawCards(state: IchiState, playerIndex: number, count: number): IchiCard[] {
  const pl = state.players[playerIndex]!
  const taken: IchiCard[] = []
  for (let i = 0; i < count; i++) {
    ensureStock(state)
    const c = state.stock[0]
    if (!c) break
    state.stock = state.stock.slice(1)
    taken.push(c)
  }
  pl.hand = sortIchiHand([...pl.hand, ...taken])
  return taken
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
      colorPicker: null,
      challengeTarget: null,
      wdfPlayer: null,
      colorBeforeWdf: null,
      ichiPending: null,
      ichiCalled: Array.from({ length: n }, () => false),
      wdfLegal: null,
      drawnPlayableId: null,
      winnerId: null,
      log: [],
      lastHandNote: null,
      lastHandScores: null,
      lastMessage: null,
    },
    seed,
  )
}

export function dealIchiHand(state: IchiState, seed: number): IchiState {
  const next = cloneIchi(state)
  const n = next.players.length
  for (const pl of next.players) pl.hand = []
  next.ichiCalled = Array.from({ length: n }, () => false)
  next.ichiPending = null
  next.colorPicker = null
  next.challengeTarget = null
  next.wdfPlayer = null
  next.colorBeforeWdf = null
  next.wdfLegal = null
  next.drawnPlayableId = null
  next.direction = 1
  next.phase = 'play'
  next.winnerId = null
  next.lastHandNote = null
  next.lastHandScores = null
  next.lastMessage = null

  let deck = shuffleIchiDeck(seed)
  for (let c = 0; c < 7; c++) {
    for (let p = 0; p < n; p++) {
      const card = deck[0]
      if (!card) break
      deck = deck.slice(1)
      next.players[p]!.hand.push(card)
    }
  }
  for (const pl of next.players) pl.hand = sortIchiHand(pl.hand)

  // Flip until we have a number for start (avoid action as start face)
  let starter: IchiCard | null = null
  const buried: IchiCard[] = []
  while (deck.length) {
    const c = deck[0]!
    deck = deck.slice(1)
    if (isNumber(c) && c.color) {
      starter = c
      break
    }
    buried.push(c)
  }
  if (!starter) {
    // Fallback: any non-wdf
    const c = buried.pop() ?? deck[0]
    if (c) {
      starter = c
      if (deck[0] === c) deck = deck.slice(1)
    }
  }
  next.stock = [...deck, ...buried]
  next.discard = starter ? [starter] : []
  if (starter && starter.color) next.currentColor = starter.color
  else if (starter && isWild(starter)) {
    next.currentColor = 'R'
    next.phase = 'colorPick'
    next.colorPicker = 0
  } else {
    next.currentColor = 'R'
  }

  next.current = 0
  next.log = [
    `Hand ${next.round} — Classic Ichi. Top ${starter ? `${starter.kind}${starter.color ?? ''}` : '?'}. ${next.players[0]!.name} leads.`,
  ]
  next.lastMessage = next.log[0]!
  return next
}

export function dealNextIchiRound(prev: IchiState, seed = Date.now()): IchiState {
  const base = cloneIchi(prev)
  base.round = prev.round + 1
  // Rotate who starts (left of previous starter conceptually — advance seat 0 rotation via current offset)
  // Keep player order; first to act = (round-1) % n for variety
  const dealt = dealIchiHand(base, seed)
  dealt.current = (prev.round) % dealt.players.length
  if (dealt.phase === 'colorPick') dealt.colorPicker = dealt.current
  dealt.log[0] =
    `Hand ${dealt.round} — Classic Ichi. ${dealt.players[dealt.current]!.name} leads.`
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

export function topCard(state: IchiState): IchiCard | null {
  return topDiscard(state)
}
