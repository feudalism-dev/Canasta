import { useEffect, useRef, useState } from 'react'
import type { HouseRules, Variant } from '../core/types'
import { familyHintPresent, resolveTableFamily, type GameFamily } from '../core/family'
import type { RummyVariant } from '../core/rummy/types'
import type { TrickVariant } from '../core/trick/types'
import { chairsFromOccupants, matchupSentence, type Occupant } from '../core/tableSeating'
import { HandAndFootHouseFields, HouseRulesPreview } from './HouseFields'
import { BetaVariantNotice } from './BetaVariantNotice'
import { VariantSelect } from './VariantSelect'
import { RummyVariantSelect } from './RummyVariantSelect'
import { TrickVariantSelect } from './TrickVariantSelect'
import { SeatMap } from './SeatMap'
import type { SlBootstrap } from '../sl/bootstrap'
import { openMatchInBrowser } from '../sl/sessionUrl'
import {
  decodeHouseCompact,
  encodeHouseCompact,
  isBetaVariant,
  isHouseRulesHandAndFoot,
  isSambaFamily,
  normalizeHouse,
} from '../core/houseRules'
import { clearMatchResume } from '../net/matchResume'
import {
  tableClaimBrowser,
  tableCreate,
  tableEnter,
  tableJoin,
  tableLeave,
  tableMintBrowser,
  tableSaveHouse,
  tableStart,
  tableStatus,
  tableEndGame,
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
  rummyVariant: RummyVariant
  onRummyVariant: (v: RummyVariant) => void
  /** Total seats for Rummy solo/MP (2–4). Empty chairs become bots. */
  rummyPlayerCount: number
  onRummyPlayerCount: (n: number) => void
  trickVariant: TrickVariant
  onTrickVariant: (v: TrickVariant) => void
  /** Total seats for Hearts solo/MP (2–4). Empty chairs become bots. */
  trickPlayerCount: number
  onTrickPlayerCount: (n: number) => void
  onFamily: (family: GameFamily) => void
  partnership: boolean
  onPartnership: (v: boolean) => void
  house: HouseRules
  onHouse: (house: HouseRules) => void
  onStartSolo: () => void | Promise<void>
  onResumeMatch?: () => void | Promise<void>
  canResumeMatch?: boolean
  onCreatedMp: (roomCode: string, tableStatus: TableStatus) => void | Promise<void>
  onJoinedMp: (roomCode: string, tableStatus: TableStatus) => void | Promise<void>
  onHostStartMp: (tableStatus?: TableStatus) => void | Promise<void>
  onLeaveLobby?: () => void | Promise<void>
  /** Drop local PeerJS before parking HUD for browser match. */
  onDetachPeer?: () => void
  /** True when this client already has match state from PeerJS. */
  peerHasState?: boolean
  onRejoinPeer?: (roomCode: string) => void | Promise<void>
  peerRoomCode?: string
  peerSeats?: { id: string; name: string; ready: boolean; isHost: boolean; avatarUid?: string; seat?: number }[]
  isPeerHost?: boolean
  onPeerReadyToggle?: (ready: boolean) => void
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
  rummyVariant,
  onRummyVariant,
  rummyPlayerCount,
  onRummyPlayerCount,
  trickVariant,
  onTrickVariant,
  trickPlayerCount,
  onTrickPlayerCount,
  onFamily,
  partnership,
  onPartnership,
  house,
  onHouse,
  onStartSolo,
  onResumeMatch,
  canResumeMatch = false,
  onCreatedMp,
  onJoinedMp,
  onHostStartMp,
  onLeaveLobby,
  onDetachPeer,
  peerHasState = false,
  onRejoinPeer,
  peerRoomCode,
  peerSeats,
  isPeerHost,
  onPeerReadyToggle,
  onHowToPlay,
  coachTips = false,
  onCoachTips,
}: Props) {
  const seatedBrowser = boot.client === 'browser' && !!boot.token
  const [entered, setEntered] = useState(false)
  const [table, setTable] = useState<TableStatus | null>(null)
  const [err, setErr] = useState('')
  const [mintBusy, setMintBusy] = useState(false)
  const enterLock = useRef(false)
  const browserClaimLock = useRef(false)
  const loadedHouseRef = useRef('')

  useEffect(() => {
    if (!isHouseRulesHandAndFoot(variant)) return
    const raw = table?.house || ''
    if (!raw || raw === loadedHouseRef.current) return
    const decoded = decodeHouseCompact(raw)
    if (!decoded) return
    loadedHouseRef.current = raw
    onHouse(decoded)
  }, [variant, table?.house, onHouse])

  useEffect(() => {
    // Never push the canasta default while status has not answered yet — that flashes
    // Hand & Foot on Rummy tables (shared HUD MoAP historically omitted ?family=).
    if (!familyHintPresent(table?.family, boot.family)) return
    onFamily(resolveTableFamily(table?.family, boot.family))
  }, [table?.family, boot.family, onFamily])

  const familyKnown = familyHintPresent(table?.family, boot.family)
  const family = resolveTableFamily(table?.family, boot.family)
  const isRummyTable = family === 'rummy'
  const isTrickTable = family === 'trick'
  const isCanastaTable = family === 'canasta'

  const enterTable = async (name: string) => {
    if (!boot.slCap) throw new Error('Waiting for table HTTP-IN URL')
    const st = await tableEnter(boot.slCap, boot.uid, boot.seat, name)
    setTable(st)
    if (!st.ok) throw new Error(st.error || 'Enter failed')
    setEntered(true)
    setStatus(seatedBrowser ? 'Browser match — linked to your table seat.' : 'Seated — this HUD drives the table.')
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

  // Seated browser: claim minted token then attach PeerJS as guest.
  useEffect(() => {
    if (!seatedBrowser || !entered || !boot.slCap || !boot.token || !boot.room) return
    if (browserClaimLock.current) return
    browserClaimLock.current = true
    let cancelled = false
    void (async () => {
      setBusy(true)
      try {
        const st = await tableClaimBrowser(boot.slCap, boot.uid, boot.seat, boot.token)
        if (!st.ok) throw new Error(st.error || 'Browser claim failed')
        if (cancelled) return
        setTable(st)
        const room = (st.roomCode || boot.room || '').toUpperCase()
        await onJoinedMp(room, st)
        setStatus(`Browser match · room ${room}`)
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Browser claim failed')
          browserClaimLock.current = false
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [seatedBrowser, entered, boot.slCap, boot.uid, boot.seat, boot.token, boot.room])

  const mode = table?.mode || 'idle'
  const activeCount = table?.activeCount ?? 0
  const me = table?.roster?.find((r) => r.uid.toLowerCase() === boot.uid.toLowerCase())
  const iAmHost = (table?.hostUid || '').toLowerCase() === boot.uid.toLowerCase()
  const iAmSolo = (table?.soloUid || '').toLowerCase() === boot.uid.toLowerCase()
  const iJoined = !!me?.joined
  const tableBusy = mode !== 'idle'
  const canSolo = !seatedBrowser && entered && !tableBusy && activeCount <= 1
  const canCreate = !seatedBrowser && entered && !tableBusy && activeCount >= 2
  const canJoin = !seatedBrowser && entered && mode === 'lobby' && !iJoined
  const canMintBrowser =
    !seatedBrowser && entered && iJoined && !iAmHost && (mode === 'lobby' || mode === 'match')
  const peerLive = Boolean(peerRoomCode) || Boolean(peerSeats && peerSeats.length)
  const matchWithoutState = mode === 'match' && iJoined && !peerHasState
  const showMpLobby = mode === 'lobby' || mode === 'match' || !!peerRoomCode || !!boot.room
  /** Host may tweak game + house rules until the match has actually started. */
  const rulesLocked = peerHasState || mode === 'match'
  const canEditRules =
    !rulesLocked && (Boolean(isPeerHost) || iAmHost || (mode === 'idle' && !table?.roomCode))
  /** Soft Menu leave / HUD restart leaves the table in solo with no lobby UI — need an explicit unlock. */
  const canFreeTable =
    !seatedBrowser &&
    entered &&
    (mode === 'solo' || mode === 'resetting' || (mode === 'match' && !peerLive && (iAmHost || iJoined)))
  const youSeat = me?.seat ?? (boot.seat >= 0 ? boot.seat : 0)
  const myPeer = (peerSeats || []).find((s) => (s.avatarUid || '').toLowerCase() === boot.uid.toLowerCase())
  const iAmReady = !!myPeer?.ready
  const peerLobby = peerSeats || []
  const allPeersReady = peerLobby.length > 0 && peerLobby.every((s) => s.ready)
  const notReadyNames = peerLobby.filter((s) => !s.ready).map((s) => s.name)
  const occupants: Occupant[] = (table?.roster || [])
    .filter((r) => r.seat >= 0)
    .map((r) => {
      const peer = (peerSeats || []).find((s) => (s.avatarUid || '').toLowerCase() === r.uid.toLowerCase())
      return {
        seat: r.seat,
        name: r.name,
        uid: r.uid,
        joined: r.joined,
        ready: peer?.ready,
      }
    })
  const seating =
    occupants.length > 0
      ? occupants
      : [{ seat: youSeat, name: displayName || 'You', uid: boot.uid, joined: iJoined }]
  const matchup = matchupSentence(chairsFromOccupants(seating, youSeat), youSeat)

  if (!entered) {
    return (
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Table · Seat {boot.seat >= 0 ? boot.seat + 1 : '?'}</p>
          <h1>Table</h1>
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
        <p className="brand-kicker">
          Seat {youSeat + 1} · {mode}
          {seatedBrowser ? ' · browser' : ''}
        </p>
        <h1>
          {!familyKnown
            ? 'Table lobby'
            : isRummyTable
              ? 'Rummy'
              : isTrickTable
                ? 'Trick'
                : 'Hand & Foot / Canasta'}
        </h1>
        {!familyKnown ? (
          <p className="muted">Connecting to this table…</p>
        ) : isRummyTable ? (
          <p className="muted">This table is locked to the Rummy family (creator SKU).</p>
        ) : isTrickTable ? (
          <p className="muted">This table is locked to the Trick family (Hearts, Rooster, …).</p>
        ) : null}
        <label>
          Name
          <input value={displayName} onChange={(e) => onNameChange(e.target.value)} />
        </label>
        {isRummyTable ? (
          <RummyVariantSelect value={rummyVariant} disabled={!canEditRules} onChange={onRummyVariant} />
        ) : isTrickTable ? (
          <TrickVariantSelect value={trickVariant} disabled={!canEditRules} onChange={onTrickVariant} />
        ) : (
          <label>
            Game
            <VariantSelect value={variant} disabled={!canEditRules} onChange={(next) => {
                onVariant(next)
                if (isHouseRulesHandAndFoot(next) && table?.house) {
                  const decoded = decodeHouseCompact(table.house)
                  if (decoded) onHouse(decoded)
                }
              }}
            />
          </label>
        )}
        {!canEditRules ? (
          <p className="muted">
            {mode === 'match'
              ? 'Game choice is locked while a match is running.'
              : mode === 'solo'
                ? 'Table is still locked from a previous solo game — Free table below, then change game.'
                : mode === 'lobby'
                  ? 'Only the lobby host can change the game until the match starts.'
                  : 'Game choice is locked for this table state.'}
          </p>
        ) : null}
        {isCanastaTable && isBetaVariant(variant) ? <BetaVariantNotice compact /> : null}
        {isCanastaTable && isSambaFamily(variant) ? <HouseRulesPreview house={house} variant={variant} /> : null}
        {!seatedBrowser && isCanastaTable ? (
          <>
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
          </>
        ) : null}
        {!seatedBrowser && isRummyTable ? (
          <>
            <label>
              Players at the table (you + bots in empty seats)
              <select
                value={rummyVariant === 'gin' || rummyVariant === 'oklahoma' ? 2 : rummyPlayerCount}
                disabled={!canEditRules || rummyVariant === 'gin' || rummyVariant === 'oklahoma'}
                onChange={(e) => onRummyPlayerCount(Number(e.target.value))}
              >
                <option value={2}>2 — you + 1 bot</option>
                {rummyVariant !== 'gin' && rummyVariant !== 'oklahoma' ? (
                  <>
                    <option value={3}>3 — you + 2 bots</option>
                    <option value={4}>4 — you + 3 bots</option>
                  </>
                ) : null}
              </select>
            </label>
            <p className="muted">
              {rummyVariant === 'gin'
                ? 'Gin Rummy is always 2 players. Knock with ≤10 deadwood; first to 100 (highest) wins.'
                : rummyVariant === 'oklahoma'
                  ? 'Oklahoma Gin is always 2 players. Knock limit comes from the upcard; play to 150 (highest).'
                  : rummyVariant === 'rummy500'
                    ? 'Rummy 500: meld scoring to 500 (highest). Tap any discard card to take it and everything above.'
                    : rummyVariant === 'kalooki'
                      ? 'Kalooki (open): 2 decks + jokers, 9 hands — lowest score wins. Free-for-all.'
                      : 'Standard Rummy is free-for-all (no partners). Multiplayer: empty chairs are bots; humans Join their seat.'}
            </p>
          </>
        ) : null}
        {!seatedBrowser && isTrickTable ? (
          <>
            {trickVariant === 'hearts' || trickVariant === 'ohhell' ? (
              <label>
                Players at the table (humans + bots in empty seats)
                <select
                  value={trickPlayerCount}
                  disabled={!canEditRules}
                  onChange={(e) => onTrickPlayerCount(Number(e.target.value))}
                >
                  <option value={2}>2 — 1v1 bot (solo) or 2 humans</option>
                  <option value={3}>3 — 1v2 bots, or 2 humans + 1 bot</option>
                  <option value={4}>4 — 1v3 / 2v2 / 3v1 bots, or 4 humans</option>
                </select>
              </label>
            ) : null}
            <p className="muted">
              {trickVariant === 'hearts'
                ? `Hearts (${trickPlayerCount} seats): empty chairs become bots.`
                : trickVariant === 'ohhell'
                  ? `Oh Hell (${trickPlayerCount} seats): bid exact tricks; empty chairs are bots.`
                  : trickVariant === 'rooster'
                    ? 'Rooster is always 4 — partners across. Nest, trump, to 300.'
                    : trickVariant === 'spades'
                      ? 'Spades is always 4 — partners across. Bid tricks / Nil / bags, to 500.'
                      : trickVariant === 'euchre'
                        ? 'Euchre is always 4 — partners across. Short deck, to 10.'
                        : 'Pick a ready trick game to play.'}
            </p>
          </>
        ) : null}
        {isCanastaTable && isHouseRulesHandAndFoot(variant) ? (
          <>
            {showMpLobby && !rulesLocked ? (
              <p className="muted">
                {canEditRules
                  ? 'Change house rules until Start. Any change clears Ready — everyone must Ready again to accept the current pack.'
                  : 'Ready means you accept the house rules below. Use Not ready while debating; the host can Start when everyone is Ready.'}
              </p>
            ) : null}
            <HouseRulesPreview house={house} variant={variant} />
            <HandAndFootHouseFields
              house={house}
              editable={canEditRules}
              onChange={onHouse}
            />
            {canEditRules && table?.ownerUid && table.ownerUid.toLowerCase() === boot.uid.toLowerCase() ? (
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      const st = await tableSaveHouse(
                        boot.slCap,
                        boot.uid,
                        youSeat,
                        encodeHouseCompact(normalizeHouse(house)),
                      )
                      if (!st.ok) throw new Error(st.error || 'Save failed')
                      setTable(st)
                      loadedHouseRef.current = encodeHouseCompact(normalizeHouse(house))
                      setStatus('House rules saved on this table.')
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'Save failed')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Save house rules to table
              </button>
            ) : null}
            {canEditRules &&
            !(table?.ownerUid && table.ownerUid.toLowerCase() === boot.uid.toLowerCase()) ? (
              <p className="muted">Tweaks apply to this match. Only the table owner can Save as the table default.</p>
            ) : null}
          </>
        ) : null}
        <SeatMap occupants={seating} youSeat={youSeat} />
        <p className="muted">{matchup}</p>
        {!seatedBrowser ? (
          <>
            {canResumeMatch && onResumeMatch ? (
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => void onResumeMatch()}
              >
                Resume paused game
              </button>
            ) : null}
            {canFreeTable || canResumeMatch ? (
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setErr('')
                    try {
                      clearMatchResume()
                      if (boot.slCap) {
                        const st = await tableEndGame(boot.slCap, boot.uid, youSeat)
                        setTable(st)
                        if (!st.ok) throw new Error(st.error || 'Could not free table')
                      }
                      setStatus('Table freed — pick a game and Play Solo.')
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'Could not free table')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                {canResumeMatch ? 'Abandon paused game' : 'Free table'}
              </button>
            ) : null}
            {canFreeTable && !canResumeMatch ? (
              <p className="error">
                {mode === 'solo'
                  ? iAmSolo
                    ? 'This table is locked in solo from an earlier game (Menu / HUD restart). Free table to play again.'
                    : 'Another seat holds the solo lock. Free table if you are that player, or wait for them to finish.'
                  : `Table mode is “${mode}” — free it before starting a new solo game.`}
              </p>
            ) : null}
            <button
              type="button"
              className="btn primary"
              disabled={!canSolo || busy || canResumeMatch}
              onClick={() => void onStartSolo()}
            >
              Play Solo vs Computer
            </button>
            <p className="muted">
              {canResumeMatch
                ? 'A game is paused for this seat (about 60 seconds). Resume it, or Abandon to start fresh.'
                : !canSolo && tableBusy
                  ? `Solo stays off while the table is “${mode}”.`
                  : isTrickTable
                    ? 'Solo fills empty seats with bots. Multiplayer: Create with 2+ humans, pick seat count, Start fills the rest with bots.'
                    : isRummyTable
                      ? 'Solo and multiplayer use your player count — empty chairs are computers.'
                      : 'Multiplayer is always four hands. Seating picks teams — empty chairs are computers.'}
            </p>
          </>
        ) : (
          <p className="muted">You joined from a minted link. Stay seated in Second Life. Host plays on the HUD.</p>
        )}
        {canCreate ? (
          <button
            type="button"
            className="btn secondary"
            disabled={
              busy ||
              (isTrickTable &&
                !['hearts', 'rooster', 'spades', 'euchre', 'ohhell'].includes(trickVariant))
            }
            onClick={async () => {
              setBusy(true)
              try {
                const st = await tableCreate(boot.slCap, boot.uid, youSeat)
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
                const st = await tableJoin(boot.slCap, boot.uid, youSeat)
                if (!st.ok) throw new Error(st.error || 'Join failed')
                setTable(st)
                try {
                  await onJoinedMp(st.roomCode || table.roomCode || '', st)
                } catch (peerErr) {
                  setErr(
                    `${peerErr instanceof Error ? peerErr.message : 'Peer link failed'} — use Play match in browser.`,
                  )
                  setStatus(`Joined room ${st.roomCode || table.roomCode} (HUD peer failed)`)
                  return
                }
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Join failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Join {table.roomCode} as Player {youSeat + 1}
          </button>
        ) : null}
        {showMpLobby ? (
          <>
            <p>
              Room <strong>{peerRoomCode || table?.roomCode || boot.room}</strong>
            </p>
            <ul>
              {(peerSeats || []).map((s) => (
                <li key={s.id}>
                  {s.isHost ? '[Host] ' : ''}
                  {s.name}
                  {s.ready ? ' — Ready ✓' : ' — Not ready'}
                </li>
              ))}
            </ul>
            {peerLive && !allPeersReady && !rulesLocked ? (
              <p className="muted">
                Waiting on Ready (rules acceptance): {notReadyNames.join(', ') || 'someone'}
              </p>
            ) : null}
            {!peerLive && iJoined ? (
              <p className="error">
                {seatedBrowser
                  ? 'Peer link not connected — Ready cannot sync. Fix WebRTC or ask the host to wait.'
                  : 'Peer link not connected on this HUD. Use Play match in browser below.'}
              </p>
            ) : null}
            {matchWithoutState ? (
              <p className="error">
                Match already started, but this page never received the game. Reconnect to the host peer.
              </p>
            ) : null}
            {matchWithoutState ? (
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const room = (peerRoomCode || table?.roomCode || boot.room || '').toUpperCase()
                    if (!room) {
                      setErr('No room code to reconnect')
                      return
                    }
                    setBusy(true)
                    setErr('')
                    try {
                      await onRejoinPeer?.(room)
                      setStatus(`Reconnected · room ${room}`)
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'Reconnect failed')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Reconnect to match
              </button>
            ) : null}
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                if (!peerLive) {
                  setErr(
                    seatedBrowser
                      ? 'No peer link — Ready needs WebRTC to accept the house rules.'
                      : 'No peer link — use Play match in browser to Ready up.',
                  )
                  return
                }
                onPeerReadyToggle?.(!iAmReady)
              }}
            >
              {iAmReady ? 'Not ready' : 'Ready — accept these rules'}
            </button>
            {canMintBrowser ? (
              <button
                type="button"
                className="btn primary"
                disabled={mintBusy}
                onClick={() => {
                  void (async () => {
                    setMintBusy(true)
                    setErr('')
                    try {
                      onDetachPeer?.()
                      const st = await tableMintBrowser(boot.slCap, boot.uid, youSeat)
                      if (!st.ok || !st.token) throw new Error(st.error || 'Mint failed')
                      const room = (st.roomCode || table?.roomCode || '').toUpperCase()
                      if (!room) throw new Error('No room code')
                      setStatus('Opening browser match… HUD will park.')
                      await openMatchInBrowser(boot, room, st.token)
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'Mint failed')
                    } finally {
                      setMintBusy(false)
                    }
                  })()
                }}
              >
                Play match in browser
              </button>
            ) : null}
            {isPeerHost && iAmHost ? (
              <button
                type="button"
                className="btn primary"
                disabled={!allPeersReady || busy}
                onClick={async () => {
                  if (!allPeersReady) {
                    setErr(
                      `Everyone must Ready first (accepts current house rules). Still waiting: ${notReadyNames.join(', ')}`,
                    )
                    return
                  }
                  const sitting = (table?.roster || []).filter((r) => r.seat >= 0)
                  const notJoined = sitting.filter((r) => !r.joined)
                  if (notJoined.length) {
                    setErr(
                      `${notJoined.map((r) => r.name).join(', ')} must Join before Start. Switch seats first if the teams are wrong.`,
                    )
                    return
                  }
                  let latest = table || undefined
                  if (boot.slCap) {
                    latest = await tableStatus(boot.slCap, boot.uid, youSeat)
                    setTable(latest)
                    await tableStart(boot.slCap, boot.uid, youSeat)
                  }
                  await onHostStartMp(latest)
                }}
              >
                Start Match
              </button>
            ) : null}
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setErr('')
                  try {
                    await onLeaveLobby?.()
                    if (boot.slCap) {
                      await tableLeave(boot.slCap, boot.uid, youSeat)
                      const enteredAgain = await tableEnter(boot.slCap, boot.uid, youSeat, displayName)
                      setTable(enteredAgain)
                      setStatus(
                        enteredAgain.mode === 'lobby'
                          ? 'Left the room — Join again when ready.'
                          : 'Left the lobby.',
                      )
                    }
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : 'Leave failed')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Leave lobby
            </button>
          </>
        ) : null}
        {isCanastaTable && onHowToPlay ? (
          <button type="button" className="btn ghost" onClick={onHowToPlay}>
            How to Play
          </button>
        ) : null}
        {isRummyTable ? (
          <p className="muted">Rummy how-to comes with the full board polish.</p>
        ) : null}
        {isTrickTable ? (
          <p className="muted">See Docs/RULES_HEARTS.md — Furware scores and the table-top MoAP update while you play.</p>
        ) : null}
        {status ? <p className="muted">{status}</p> : null}
        {err ? <p className="error">{err}</p> : null}
      </div>
    </div>
  )
}
