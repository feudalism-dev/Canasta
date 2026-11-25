import { STACK_CAP, unitDef, type UnitStack, type WarfrontUnit } from './types'

export function emptyStack(): UnitStack {
  return {}
}

export function cloneStack(s: UnitStack): UnitStack {
  return { ...s }
}

export function stackCount(s: UnitStack): number {
  let n = 0
  for (const v of Object.values(s)) n += v ?? 0
  return n
}

export function addUnits(target: UnitStack, add: UnitStack): UnitStack {
  const out = cloneStack(target)
  for (const [k, v] of Object.entries(add)) {
    if (!v) continue
    const unit = k as WarfrontUnit
    out[unit] = (out[unit] ?? 0) + v
  }
  return out
}

export function subUnits(target: UnitStack, rem: UnitStack): UnitStack | null {
  const out = cloneStack(target)
  for (const [k, v] of Object.entries(rem)) {
    if (!v) continue
    const unit = k as WarfrontUnit
    const have = out[unit] ?? 0
    if (have < v) return null
    const next = have - v
    if (next <= 0) delete out[unit]
    else out[unit] = next
  }
  return out
}

export function hasUnits(s: UnitStack): boolean {
  return stackCount(s) > 0
}

export function occupationCount(s: UnitStack): number {
  let n = 0
  for (const [k, v] of Object.entries(s)) {
    if (!v) continue
    const d = unitDef(k as WarfrontUnit)
    if (d?.canOccupy) n += v
  }
  return n
}

export function rangedCount(s: UnitStack): number {
  let n = 0
  for (const [k, v] of Object.entries(s)) {
    if (!v) continue
    const d = unitDef(k as WarfrontUnit)
    if (d?.ranged) n += v
  }
  return n
}

export function estimateAtk(s: UnitStack, enemyHasTanks = false): number {
  let t = 0
  for (const [k, v] of Object.entries(s)) {
    if (!v) continue
    const unit = k as WarfrontUnit
    const d = unitDef(unit)
    if (!d) continue
    let atk = d.atk
    if (unit === 'antitank' && enemyHasTanks) atk += 1
    t += atk * v
  }
  return t
}

export function estimateDef(s: UnitStack): number {
  let t = 0
  for (const [k, v] of Object.entries(s)) {
    if (!v) continue
    const d = unitDef(k as WarfrontUnit)
    if (!d) continue
    t += d.def * v
  }
  return t
}

export function hasTank(s: UnitStack): boolean {
  return (s.tank ?? 0) > 0
}

export function fitsCap(current: UnitStack, add: UnitStack): boolean {
  return stackCount(current) + stackCount(add) <= STACK_CAP
}

export function stackWire(s: UnitStack): string {
  // Compact: unitChar + count for non-zero
  const chars: Record<string, string> = {
    infantry: 'i',
    antitank: 'a',
    tank: 't',
    artillery: 'r',
    escort: 'e',
    sub: 'u',
    capital: 'c',
    carrier: 'v',
  }
  let out = ''
  for (const [k, ch] of Object.entries(chars)) {
    const n = s[k as WarfrontUnit] ?? 0
    if (n > 0) out += ch + n.toString(36)
  }
  return out || '0'
}

export function parseStackWire(raw: string): UnitStack {
  if (!raw || raw === '0') return {}
  const map: Record<string, WarfrontUnit> = {
    i: 'infantry',
    a: 'antitank',
    t: 'tank',
    r: 'artillery',
    e: 'escort',
    u: 'sub',
    c: 'capital',
    v: 'carrier',
  }
  const out: UnitStack = {}
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]!
    const unit = map[ch]
    if (!unit) {
      i += 1
      continue
    }
    i += 1
    let num = ''
    while (i < raw.length && /[0-9a-z]/.test(raw[i]!)) {
      num += raw[i]
      i += 1
      break // single base36 digit count (1–8 fits)
    }
    const n = parseInt(num || '0', 36)
    if (n > 0) out[unit] = (out[unit] ?? 0) + n
  }
  return out
}
