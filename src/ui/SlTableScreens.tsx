import { useEffect, useRef, useState } from 'react'
import type { HouseRules, Variant } from '../core/types'
import { HandAndFootHouseFields } from './HouseFields'
import type { SlBootstrap } from '../sl/bootstrap'
import {
  tableCreate,
  tableEnter,
  tableJoin,
  tableStart,
  tableStatus,
  type TableStatus,
} from '../sl/tableApi'

type Props = {
  boot: SlBootstrap
  displayName: string
  onNameChange: (name: string) => void
  busy: boolean
  setBusy: (v: boolean) => void
  status: string
  setStatus: (s: string) => void
  variant: Variant
  onVariant: (v: Variant) => void
  partnership: boolean
  onPartnership: (v: boolean) => void
  house: HouseRules
  onHouse: (house: HouseRules) => void
  onStartSolo: () => void | Promise<void>
  onCreatedMp: (roomCode: string, tableStatus: TableStatus) => void | Promise<void>
  onJoinedMp: (roomCode: string, tableStatus: TableStatus) => void | Promise<void>
  onHostStartMp: (tableStatus?: TableStatus) => void | Promise<void>
  onLeaveLobby?: () => void | Promise<void>
  peerRoomCode?: string
  peerSeats?: { id: string; name: string; ready: boolean; isHost: boolean }[]
  isPeerHost?: boolean
  onPeerReady?: () => void
  onHowToPlay?: () => void
  coachTips?: boolean
  onCoachTips?: (on: boolean) => void
}

export function SlTableScreens({
  boot,
  displayName,
  onNameChange,
  busy,
  setBusy,
  status,
  setStatus,
  variant,
  onVariant,
  partnership,
  onPartnership,
  house,
  onHouse,
  onStartSolo,
  onCreatedMp,
  onJoinedMp,
  onHostStartMp,
  onLeaveLobby,
  peerRoomCode,
  peerSeats,
  isPeerHost,
  onPeerReady,
  onHowToPlay,
  coachTips = true,
  onCoachTips,
}: Props) {
  const [entered, setEntered] = useState(false)
  const [table, setTable] = useState<TableStatus | null>(null)
  const [err, setErr] = useState('')
  const enterLock = useRef(false)

  const enterTable = async (name: string) => {
    if (!boot.slCap) throw new Error('Waiting for table HTTP-IN URL')
    const st = await tableEnter(boot.slCap, boot.uid, boot.seat, name)
    setTable(st)
    if (!st.ok) throw new Error(st.error || 'Enter failed')
    setEntered(true)
    setStatus('Seated — this HUD drives the table.')
  }

  const refresh = async () => {
    if (!boot.slCap) return
    try {
      const st = await tableStatus(boot.slCap, boot.uid, boot.seat)
      setTable(st)
      setErr(st.ok ? '' : st.error || 'Table error')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cannot reach table')
    }
  }

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 3000)
    return () => window.clearInterval(id)
  }, [boot.slCap, boot.uid, boot.seat, entered])

  useEffect(() => {
    if (entered || !boot.slCap || enterLock.current) return
    enterLock.current = true
    let cancelled = false
    void (async () => {
      setBusy(true)
      try {
        await enterTable(displayName)
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Enter failed')
          enterLock.current = false
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [boot.slCap, boot.uid, boot.seat])

  const mode = table?.mode || 'idle'
  const activeCount = table?.activeCount ?? 0
  const me = table?.roster?.find((r) => r.uid.toLowerCase() === boot.uid.toLowerCase())
  const iAmHost = (table?.hostUid || '').toLowerCase() === boot.uid.toLowerCase()
  const iJoined = !!me?.joined
  const tableBusy = mode !== 'idle'
  const canSolo = entered && !tableBusy && activeCount <= 1
  const canCreate = entered && !tableBusy && activeCount >= 2
  const canJoin = entered && mode === 'lobby' && !iJoined
  const showMpLobby = mode === 'lobby' || mode === 'match' || !!peerRoomCode

  if (!entered) {
    return (
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Table · Seat {boot.seat >= 0 ? boot.seat + 1 : '?'}</p>
          <h1>Canasta</h1>
          <p>Waiting for the table handshake…</p>
          {err ? <p className="error">{err}</p> : null}
          <button
            type="button"
            className="btn primary"
            disabled={busy || !boot.slCap}
            onClick={() => {
              enterLock.current = false
              void enterTable(displayName).catch((e) => setErr(e instanceof Error ? e.message : 'Enter failed'))
            }}
          >
            Retry enter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="shell-menu">
      <div className="menu-card">
        <p className="brand-kicker">Seat {(boot.seat >= 0 ? boot.seat : 0) + 1} · {mode}</p>
        <h1>Canasta &amp; Hand and Foot</h1>
        <label>
          Name
          <input value={displayName} onChange={(e) => onNameChange(e.target.value)} />
        </label>
        <label>
          Game
          <select value={variant} onChange={(e) => onVariant(e.target.value as Variant)}>
            <option value="canasta">Classic Canasta</option>
            <option value="handAndFoot">Hand and Foot</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={partnership} onChange={(e) => onPartnership(e.target.checked)} />
          Solo with AI partner (4 hands)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={coachTips}
            onChange={(e) => onCoachTips?.(e.target.checked)}
          />
          Coach — tips on how to play
        </label>
        {variant === 'handAndFoot' ? <HandAndFootHouseFields house={house} onChange={onHouse} /> : null}
        <button
          type="button"
          className="btn primary"
          disabled={!canSolo || busy}
          onClick={() => void onStartSolo()}
        >
          Play Solo vs Computer
        </button>
        <p className="muted">Multiplayer: everyone must sit at this table.</p>
        {canCreate ? (
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const st = await tableCreate(boot.slCap, boot.uid, boot.seat)
                if (!st.ok || !st.roomCode) throw new Error(st.error || 'Create failed')
                await onCreatedMp(st.roomCode, st)
                setStatus(`Room ${st.roomCode}`)
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Create failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Create Multiplayer
          </button>
        ) : null}
        {canJoin && table?.roomCode ? (
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const st = await tableJoin(boot.slCap, boot.uid, boot.seat)
                if (!st.ok) throw new Error(st.error || 'Join failed')
                await onJoinedMp(st.roomCode || table.roomCode || '', st)
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Join failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Join {table.roomCode}
          </button>
        ) : null}
        {showMpLobby ? (
          <>
            <p>
              Room <strong>{peerRoomCode || table?.roomCode}</strong>
            </p>
            <ul>
              {(peerSeats || []).map((s) => (
                <li key={s.id}>
                  {s.isHost ? '[Host] ' : ''}
                  {s.name}
                  {s.ready ? ' ✓' : ''}
                </li>
              ))}
            </ul>
            <button type="button" className="btn secondary" onClick={onPeerReady}>
              Ready
            </button>
            {isPeerHost && iAmHost ? (
              <button
                type="button"
                className="btn primary"
                onClick={async () => {
                  if (boot.slCap) await tableStart(boot.slCap, boot.uid, boot.seat)
                  await onHostStartMp(table || undefined)
                }}
              >
                Start Match
              </button>
            ) : null}
            <button type="button" className="btn ghost" onClick={() => void onLeaveLobby?.()}>
              Leave lobby
            </button>
          </>
        ) : null}
        <button type="button" className="btn ghost" onClick={onHowToPlay}>
          How to Play
        </button>
        {status ? <p className="muted">{status}</p> : null}
        {err ? <p className="error">{err}</p> : null}
      </div>
    </div>
  )
}
