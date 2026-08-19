import { teamOfSeat } from './variants'

export const COMPUTER_NAMES = ['Brass', 'Velvet', 'Lamp Light'] as const

export type Occupant = {
  seat: number
  name: string
  uid?: string
  joined?: boolean
  ready?: boolean
}

export type ChairView = {
  seat: number
  name: string
  computer: boolean
  you: boolean
  relation: 'you' | 'partner' | 'opponent' | 'computer'
  team: 0 | 1
  joined?: boolean
  ready?: boolean
}

export const SEAT_HINT =
  'Opposite chairs are partners; adjacent chairs are opponents. Empty chairs are computers. Switch seats before you Join or Start if you want a different partner.'

export function partnerSeatOf(seat: number): number {
  return (seat + 2) % 4
}

export function fourHandRoster(occupants: Occupant[]): { names: string[]; humans: boolean[] } {
  const bySeat: (Occupant | undefined)[] = [undefined, undefined, undefined, undefined]
  for (const o of occupants) {
    if (o.seat >= 0 && o.seat < 4) bySeat[o.seat] = o
  }
  const names: string[] = []
  const humans: boolean[] = []
  let ai = 0
  for (let i = 0; i < 4; i++) {
    const o = bySeat[i]
    if (o) {
      names.push(o.name || `Player ${i + 1}`)
      humans.push(true)
    } else {
      names.push(COMPUTER_NAMES[ai] ?? `Computer ${i + 1}`)
      humans.push(false)
      ai += 1
    }
  }
  return { names, humans }
}

export function chairsFromOccupants(occupants: Occupant[], youSeat: number): ChairView[] {
  const roster = fourHandRoster(occupants)
  const bySeat = new Map(occupants.filter((o) => o.seat >= 0 && o.seat < 4).map((o) => [o.seat, o]))
  const youTeam = youSeat >= 0 ? teamOfSeat(youSeat) : 0
  return roster.names.map((name, seat) => {
    const o = bySeat.get(seat)
    const computer = !roster.humans[seat]
    const you = seat === youSeat && !computer
    let relation: ChairView['relation'] = 'computer'
    if (you) relation = 'you'
    else if (!computer && teamOfSeat(seat) === youTeam) relation = 'partner'
    else if (!computer) relation = 'opponent'
    return {
      seat,
      name,
      computer,
      you,
      relation,
      team: teamOfSeat(seat),
      joined: o?.joined,
      ready: o?.ready,
    }
  })
}

export function matchupSentence(chairs: ChairView[], youSeat: number): string {
  const humans = chairs.filter((c) => !c.computer)
  const you = chairs[youSeat]
  const partner = chairs[partnerSeatOf(youSeat)]
  const oppA = chairs.find((c) => c.team !== (you?.team ?? 0) && c.seat < 2)
  const oppB = chairs.find((c) => c.team !== (you?.team ?? 0) && c.seat >= 2)
  const partnerName = partner?.name ?? 'a computer'
  const oppNames = [oppA?.name, oppB?.name].filter(Boolean).join(' and ')
  if (humans.length <= 1) {
    return `You are Player ${youSeat + 1}. Empty chairs are computers — sit another chair before Start if you want a different player number.`
  }
  if (humans.length === 2) {
    const other = humans.find((c) => c.seat !== youSeat)
    const sameTeam = humans[0]!.team === humans[1]!.team
    if (sameTeam) {
      return `Co-op: you and ${partnerName} (Players ${youSeat + 1} & ${partnerSeatOf(youSeat) + 1}) vs ${oppNames}. Sit adjacent if you wanted versus.`
    }
    return `Versus: you vs ${other?.name ?? 'the other player'}, each with a computer partner. Sit opposite if you wanted to be partners.`
  }
  if (humans.length === 4 && partner && !partner.computer) {
    return `You and ${partner.name} are partners vs ${oppNames}.`
  }
  if (partner && !partner.computer) {
    return `You and ${partner.name} are partners vs ${oppNames}. The empty chair is a computer.`
  }
  return `You play with a computer partner vs ${oppNames}. Sit opposite a human if you wanted them as your partner.`
}
