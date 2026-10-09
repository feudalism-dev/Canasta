import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import './styles/parlor.css'
import { AppChrome } from './ui/AppChrome'
import { readCoachTips, writeCoachTips } from './ui/coachPref'
import { readOppBooks, readOurBooks, writeOppBooks, writeOurBooks } from './ui/oppTrayPref'
import { GameBoard } from './ui/GameBoard'
import { HowToPlay } from './ui/HowToPlay'
import { HandAndFootHouseFields, HouseRulesPreview } from './ui/HouseFields'
import { BetaVariantNotice } from './ui/BetaVariantNotice'
import { VariantSelect } from './ui/VariantSelect'
import { RummyBoard } from './ui/RummyBoard'
import { SlTableScreens } from './ui/SlTableScreens'
import { ParkedHud } from './ui/ParkedHud'
import { Scoreboard } from './ui/Scoreboard'
import { SpectatorTable } from './ui/SpectatorTable'
import { resolveTableFamily, type GameFamily } from './core/family'
import type { RummyVariant } from './core/rummy/types'
import { ToastManager, useToasts } from './ui/ToastManager'
import { addCardToGroups, addRankToGroups } from './ui/meldSelect'
import { resumeSolo, startSolo, soloSeatCount, type LocalControllers } from './ui/localSession'
import type { AiDifficulty } from './ai/heuristic'
import { planPileTake } from './core/rules'
import { cloneState } from './core/state'
import { DEFAULT_HOUSE, isBetaVariant, isHouseRulesHandAndFoot, isSambaFamily, normalizeHouse } from './core/houseRules'
import type { HouseRules, MatchState, Variant } from './core/types'
import { createPeerHost, joinPeerRoom, type PeerSession } from './net/peerSession'
import {
  createRummyPeerHost,
  joinRummyPeerRoom,
  type RummyPeerSession,
} from './net/rummyPeerSession'
import { startRummySolo, type RummyLocalSession } from './ui/rummyLocalSession'
import {
  clearMatchResume,
  loadMatchResume,
  MATCH_RESUME_GRACE_MS,
  saveMatchResume,
  secondsLeft,
} from './net/matchResume'
import { isSeatedBrowserSession, isTableHudSession, readSlBootstrap, readWebNameHint } from './sl/bootstrap'
import { emitDisplayPipes, emitPublicBoard } from './sl/displaySync'
import { emitRummyDisplay, resetRummyDisplaySync } from './sl/rummyDisplaySync'
import { tableClaimSolo, tableEndGame } from './sl/tableApi'
import { playYourTurnBell } from './ui/sfx'

type Screen = 'menu' | 'setup' | 'game' | 'help' | 'sl'

export default function App() {
  return (
    <ToastManager>
      <AppInner />
    </ToastManager>
  )
}

function AppInner() {
  const { push } = useToasts()
  const slBoot = useMemo(() => readSlBootstrap(), [])
  const tableHud = isTableHudSession(slBoot)
  const seatedBrowser = isSeatedBrowserSession(slBoot)
  const urlPlayRummy = (() => {
    try {
      return new URL(window.location.href).searchParams.get('play') === 'rummy'
    } catch {
      return false
    }
  })()
  const [screen, setScreen] = useState<Screen>(
    tableHud || seatedBrowser ? 'sl' : urlPlayRummy ? 'game' : 'menu',
  )
  const [name, setName] = useState(slBoot?.name || readWebNameHint() || 'You')
  const [variant, setVariant] = useState<Variant>('canasta')
  const [family, setFamily] = useState<GameFamily>(() => {
    try {
      return resolveTableFamily(
        new URL(window.location.href).searchParams.get('family'),
        slBoot?.family,
      )
    } catch {
      return resolveTableFamily(slBoot?.family)
    }
  })
  const [rummyVariant, setRummyVariant] = useState<RummyVariant>('standard')
  const [rummyPlayerCount, setRummyPlayerCount] = useState(2)
  const [rummyPlay, setRummyPlay] = useState(urlPlayRummy)
  const [rummyLocal, setRummyLocal] = useState<RummyLocalSession | null>(null)
  const [rummyPeer, setRummyPeer] = useState<RummyPeerSession | null>(null)
  const [partnership, setPartnership] = useState(true)
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [house, setHouse] = useState<HouseRules>({ ...DEFAULT_HOUSE })
  const [coachTips, setCoachTips] = useState(readCoachTips)
  const [showOppBooks, setShowOppBooks] = useState(readOppBooks)
  const [showOurBooks, setShowOurBooks] = useState(readOurBooks)
  const [local, setLocal] = useState<LocalControllers | null>(null)
  const [peer, setPeer] = useState<PeerSession | null>(null)
  const [tick, setTick] = useState(0)
  const [meldGroups, setMeldGroups] = useState<string[][]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const lastToast = useRef('')
  const slMatchKind = useRef<'none' | 'solo' | 'mp'>('none')
  const prevMatchRef = useRef<MatchState | null>(null)
  const lastMoveRef = useRef<{ move: Parameters<LocalControllers['submit']>[0]; index: number } | null>(null)

  useEffect(() => {
    if (!peer) return
    return peer.onChange(() => setTick((t) => t + 1))
  }, [peer])

  useEffect(() => {
    if (!peer || peer.isHost) return
    setVariant(peer.variant)
    setHouse(normalizeHouse(peer.house))
  }, [peer, tick])

  useEffect(() => {
    if (!local) return
    return local.onChange(() => setTick((t) => t + 1))
  }, [local])

  const state = local?.state ?? peer?.state ?? null
  const localIndex = local?.localIndex ?? peer?.localIndex ?? 0
  const aiThinking = local?.aiThinking ?? peer?.aiThinking ?? false
  const disconnectWait = peer?.disconnectWait ?? null
  const [waitNow, setWaitNow] = useState(() => Date.now())
  const wasMyTurnRef = useRef(false)

  useEffect(() => {
    if (!disconnectWait) return
    const id = window.setInterval(() => setWaitNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [disconnectWait?.until, disconnectWait?.name])

  useEffect(() => {
    if (!state || screen !== 'game') {
      wasMyTurnRef.current = false
      return
    }
    const mine =
      state.currentPlayer === localIndex &&
      (state.phase === 'awaitingDraw' || state.phase === 'awaitingPlay')
    if (mine && !wasMyTurnRef.current) {
      // Slight delay so the chime isn't buried under deal/discard cues.
      window.setTimeout(() => playYourTurnBell(), 120)
    }
    wasMyTurnRef.current = mine
  }, [state?.currentPlayer, state?.phase, state?.turnNumber, localIndex, screen, tick])

  const persistActiveMatch = () => {
    if (!state || state.phase === 'matchEnd') return
    if (!slBoot) return
    const until = Date.now() + MATCH_RESUME_GRACE_MS
    if (peer) {
      saveMatchResume({
        until,
        kind: 'mp',
        roomCode: peer.roomCode,
        tableId: slBoot.tableId,
        uid: slBoot.uid,
        seat: slBoot.seat,
        isHost: peer.isHost,
        state: cloneState(state),
        variant: peer.variant,
        house: normalizeHouse(peer.house),
        difficulty,
        localIndex: peer.localIndex,
        playerName: name,
      })
      return
    }
    if (local) {
      saveMatchResume({
        until,
        kind: 'solo',
        roomCode: '',
        tableId: slBoot.tableId,
        uid: slBoot.uid,
        seat: slBoot.seat,
        isHost: true,
        state: cloneState(state),
        variant,
        house,
        difficulty,
        localIndex: local.localIndex,
        playerName: name,
      })
    }
  }

  const persistRef = useRef(persistActiveMatch)
  persistRef.current = persistActiveMatch
  useEffect(() => {
    const onHide = () => persistRef.current()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  const wrap = (node: ReactNode) => {
    const rummyUi = family === 'rummy' || rummyPlay || Boolean(rummyLocal) || Boolean(rummyPeer)
    return (
      <div className="app-frame" style={{ '--felt': '#0c1f18' } as CSSProperties}>
        <AppChrome
          slBoot={tableHud || seatedBrowser || slBoot?.parked ? slBoot : null}
          parked={Boolean(slBoot?.parked)}
          roomCode={rummyPeer?.roomCode || peer?.roomCode || slBoot?.room}
          showOppBooks={showOppBooks}
          onShowOppBooks={
            rummyUi
              ? undefined
              : (on) => {
                  writeOppBooks(on)
                  setShowOppBooks(on)
                }
          }
          showOurBooks={showOurBooks}
          onShowOurBooks={
            rummyUi
              ? undefined
              : (on) => {
                  writeOurBooks(on)
                  setShowOurBooks(on)
                }
          }
          coachTips={!rummyUi && Boolean(local) && screen === 'game' ? coachTips : undefined}
          onCoachTips={
            !rummyUi && local && screen === 'game'
              ? (on) => {
                  writeCoachTips(on)
                  setCoachTips(on)
                }
              : undefined
          }
          onMenu={
            screen === 'game' && (state || rummyPlay || rummyLocal || rummyPeer?.state)
              ? () => void leaveToMenu(true)
              : undefined
          }
          onStatus={(msg) => {
            setStatus(msg)
            push(msg)
          }}
        />
        <div className="app-scale">{node}</div>
      </div>
    )
  }

  useEffect(() => {
    if ((peer?.state || rummyPeer?.state || rummyLocal) && screen === 'sl') setScreen('game')
  }, [peer?.state, rummyPeer?.state, rummyLocal, screen, tick])

  useEffect(() => {
    if (!rummyPeer) return
    return rummyPeer.onChange(() => setTick((t) => t + 1))
  }, [rummyPeer])

  useEffect(() => {
    if (!rummyLocal) return
    return rummyLocal.onChange(() => setTick((t) => t + 1))
  }, [rummyLocal])

  useEffect(() => {
    if (!state?.lastMessage) return
    setStatus(state.lastMessage)
    if (state.lastMessage !== lastToast.current) {
      lastToast.current = state.lastMessage
      push(state.lastMessage)
    }
  }, [state?.lastMessage, tick, push])

  useEffect(() => {
    if (!state || !tableHud || !slBoot?.slCap) return
    const isEmitter = Boolean(local) || peer?.isHost === true
    if (!isEmitter) {
      prevMatchRef.current = cloneState(state)
      return
    }
    void emitPublicBoard(state, slBoot.slCap, slBoot.uid, slBoot.seat)
    if (lastMoveRef.current) {
      void emitDisplayPipes(
        prevMatchRef.current,
        state,
        lastMoveRef.current.move,
        lastMoveRef.current.index,
        slBoot.slCap,
        slBoot.uid,
        slBoot.seat,
      )
    }
    prevMatchRef.current = cloneState(state)
  }, [tick, state, local, peer, slBoot, tableHud])

  useEffect(() => {
    const rummyState = rummyLocal?.state ?? rummyPeer?.state
    if (!rummyState || !tableHud || !slBoot?.slCap) return
    const isEmitter = Boolean(rummyLocal) || rummyPeer?.isHost === true
    if (!isEmitter) return
    emitRummyDisplay(rummyState, slBoot.slCap, slBoot.uid, slBoot.seat)
  }, [tick, rummyLocal, rummyPeer, slBoot, tableHud])

  const submit = (move: Parameters<LocalControllers['submit']>[0]) => {
    lastMoveRef.current = { move, index: localIndex }
    if (local) {
      const res = local.submit(move)
      if (!res.ok) {
        push(res.error)
        setStatus(res.error)
        setTick((t) => t + 1)
        return
      }
    } else if (peer) {
      const res = peer.submit(move)
      if (!res.ok) {
        push(res.error)
        setStatus(res.error)
        setTick((t) => t + 1)
        return
      }
    }
    setMeldGroups([])
    setTick((t) => t + 1)
  }

  const startLocal = async () => {
    local?.destroy()
    peer?.destroy()
    rummyLocal?.destroy()
    rummyPeer?.destroy()
    if (family === 'rummy') {
      if (tableHud && slBoot?.slCap) {
        try {
          await tableClaimSolo(slBoot.slCap, slBoot.uid, slBoot.seat, rummyPlayerCount)
        } catch (e) {
          push(e instanceof Error ? e.message : 'Could not claim table')
        }
      }
      const humanSeat = tableHud && slBoot && slBoot.seat >= 0 ? slBoot.seat : 0
      const ctrl = startRummySolo(name, rummyPlayerCount, rummyVariant, humanSeat)
      resetRummyDisplaySync()
      setLocal(null)
      setPeer(null)
      setRummyPeer(null)
      setRummyLocal(ctrl)
      setRummyPlay(false)
      slMatchKind.current = tableHud ? 'solo' : 'none'
      setScreen('game')
      push(`Rummy solo — ${rummyPlayerCount} players (you + ${rummyPlayerCount - 1} bot${rummyPlayerCount > 2 ? 's' : ''}).`)
      return
    }
    const humanSeat = tableHud && slBoot && slBoot.seat >= 0 ? slBoot.seat : 0
    const playerCount = soloSeatCount(partnership, humanSeat)
    if (tableHud && slBoot?.slCap) {
      try {
        await tableClaimSolo(slBoot.slCap, slBoot.uid, slBoot.seat, playerCount)
      } catch (e) {
        push(e instanceof Error ? e.message : 'Could not claim table')
      }
    }
    const ctrl = startSolo(name, variant, partnership, difficulty, house, humanSeat)
    prevMatchRef.current = null
    setLocal(ctrl)
    setPeer(null)
    setRummyLocal(null)
    setRummyPeer(null)
    setRummyPlay(false)
    slMatchKind.current = tableHud ? 'solo' : 'none'
    setScreen('game')
    push(ctrl.state.lastMessage)
  }

  const leaveToMenu = async (forceEnd = false) => {
    const midMatch = Boolean(state && state.phase !== 'matchEnd' && state.phase !== 'roundEnd')
    if (midMatch && !forceEnd) {
      persistActiveMatch()
      peer?.destroy()
      local?.destroy()
      setPeer(null)
      setLocal(null)
      // Soft leave: keep table lock / grace so same seat can resume.
      slMatchKind.current = slMatchKind.current === 'none' ? 'none' : slMatchKind.current
      setScreen(tableHud ? 'sl' : 'menu')
      push('Game paused — rejoin within 60 seconds to resume, or Quit from the wait screen.')
      return
    }
    clearMatchResume()
    peer?.destroy()
    local?.destroy()
    rummyPeer?.destroy()
    rummyLocal?.destroy()
    setPeer(null)
    setLocal(null)
    setRummyPeer(null)
    setRummyLocal(null)
    setRummyPlay(false)
    if (tableHud && slBoot?.slCap && slMatchKind.current !== 'none') {
      try {
        await tableEndGame(slBoot.slCap, slBoot.uid, slBoot.seat)
      } catch {
        /* ignore */
      }
    }
    slMatchKind.current = 'none'
    setScreen(tableHud ? 'sl' : 'menu')
  }

  const tryResumeSavedMatch = async () => {
    if (!slBoot) return false
    const snap = loadMatchResume({ uid: slBoot.uid, seat: slBoot.seat, tableId: slBoot.tableId })
    if (!snap) return false
    peer?.destroy()
    local?.destroy()
    if (snap.kind === 'solo') {
      const ctrl = resumeSolo(snap.state, snap.localIndex, snap.difficulty || difficulty)
      setLocal(ctrl)
      setPeer(null)
      setVariant(snap.variant)
      setHouse(normalizeHouse(snap.house))
      slMatchKind.current = 'solo'
      setScreen('game')
      clearMatchResume()
      push('Resumed your solo game.')
      return true
    }
    if (snap.isHost) {
      const session = await createPeerHost(snap.playerName || name, {
        roomCode: snap.roomCode,
        avatarUid: slBoot.uid,
        seat: slBoot.seat,
        variant: snap.variant,
        house: normalizeHouse(snap.house),
        difficulty: snap.difficulty || difficulty,
        resumeState: snap.state,
      })
      setPeer(session)
      setLocal(null)
      setVariant(snap.variant)
      setHouse(normalizeHouse(snap.house))
      slMatchKind.current = 'mp'
      setScreen('game')
      clearMatchResume()
      push('Resumed as host — waiting for others to reconnect.')
      return true
    }
    const session = await joinPeerRoom(snap.roomCode, snap.playerName || name, {
      avatarUid: slBoot.uid,
      seat: slBoot.seat,
    })
    setPeer(session)
    setLocal(null)
    slMatchKind.current = 'mp'
    setScreen('game')
    clearMatchResume()
    push('Rejoined the room.')
    return true
  }

  if (slBoot?.view === 'table') {
    return <SpectatorTable slCap={slBoot.slCap} familyHint={slBoot.family} />
  }

  if (slBoot?.view === 'scores') {
    return <Scoreboard slCap={slBoot.slCap} />
  }

  if (slBoot?.parked) return wrap(<ParkedHud boot={slBoot} />)

  if (slBoot?.action === 'browser' && slBoot.client !== 'browser') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Second Life</p>
          <h2>Opening your browser</h2>
          <p>Confirm the Second Life dialog. This HUD will park so you do not run two clients.</p>
        </div>
      </div>,
    )
  }

  if (
    screen === 'sl' &&
    (tableHud || seatedBrowser) &&
    slBoot &&
    !state &&
    !rummyLocal &&
    !rummyPeer?.state
  ) {
    return wrap(
      <SlTableScreens
        boot={slBoot}
        displayName={name}
        onNameChange={setName}
        busy={busy}
        setBusy={setBusy}
        status={status}
        setStatus={setStatus}
        variant={variant}
        onVariant={(v) => {
          setVariant(v)
          peer?.setVariant(v)
        }}
        rummyVariant={rummyVariant}
        onRummyVariant={(v) => {
          setRummyVariant(v)
          if (v === 'gin') setRummyPlayerCount(2)
          rummyPeer?.setVariant(v)
        }}
        rummyPlayerCount={rummyVariant === 'gin' ? 2 : rummyPlayerCount}
        onRummyPlayerCount={(n) => {
          const next = rummyVariant === 'gin' ? 2 : n
          setRummyPlayerCount(next)
          rummyPeer?.setPlayerCount(next)
        }}
        onFamily={setFamily}
        partnership={partnership}
        onPartnership={setPartnership}
        onStartSolo={startLocal}
        onResumeMatch={() => void tryResumeSavedMatch()}
        canResumeMatch={Boolean(
          slBoot &&
            family !== 'rummy' &&
            loadMatchResume({ uid: slBoot.uid, seat: slBoot.seat, tableId: slBoot.tableId }),
        )}
        onCreatedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          rummyPeer?.destroy()
          if (family === 'rummy') {
            const session = await createRummyPeerHost(name, {
              roomCode,
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
              variant: rummyVariant,
              playerCount: rummyPlayerCount,
            })
            setRummyPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          const session = await createPeerHost(name, {
            roomCode,
            avatarUid: slBoot.uid,
            seat: slBoot.seat,
            variant,
            house,
            difficulty,
          })
          setPeer(session)
          setLocal(null)
          setRummyPeer(null)
          setRummyLocal(null)
          slMatchKind.current = 'mp'
        }}
        onJoinedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          rummyPeer?.destroy()
          if (family === 'rummy') {
            const session = await joinRummyPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setRummyPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          const session = await joinPeerRoom(roomCode, name, { avatarUid: slBoot.uid, seat: slBoot.seat })
          setPeer(session)
          setLocal(null)
          setRummyPeer(null)
          setRummyLocal(null)
          slMatchKind.current = 'mp'
        }}
        house={house}
        onHouse={(h) => {
          setHouse(h)
          peer?.setHouse(h)
        }}
        onHostStartMp={(tableStatus) => {
          const occupants = (tableStatus?.roster || [])
            .filter((r) => r.seat >= 0 && r.joined)
            .map((r) => ({ seat: r.seat, name: r.name, uid: r.uid, joined: true }))
          if (family === 'rummy') {
            rummyPeer?.startMatch(occupants)
          } else {
            peer?.startMatch(occupants)
          }
          setTick((t) => t + 1)
        }}
        onLeaveLobby={async () => {
          peer?.destroy()
          rummyPeer?.destroy()
          setPeer(null)
          setRummyPeer(null)
          slMatchKind.current = 'none'
        }}
        onDetachPeer={() => {
          peer?.destroy()
          rummyPeer?.destroy()
          setPeer(null)
          setRummyPeer(null)
          slMatchKind.current = 'none'
        }}
        peerHasState={Boolean(peer?.state || rummyPeer?.state)}
        onRejoinPeer={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          rummyPeer?.destroy()
          if (family === 'rummy') {
            const session = await joinRummyPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setRummyPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          const session = await joinPeerRoom(roomCode, name, { avatarUid: slBoot.uid, seat: slBoot.seat })
          setPeer(session)
          setLocal(null)
          setRummyPeer(null)
          setRummyLocal(null)
          slMatchKind.current = 'mp'
        }}
        peerRoomCode={rummyPeer?.roomCode || peer?.roomCode}
        peerSeats={rummyPeer?.seats || peer?.seats}
        isPeerHost={rummyPeer?.isHost ?? peer?.isHost}
        onPeerReadyToggle={(ready) => {
          rummyPeer?.setReady(ready)
          peer?.setReady(ready)
        }}
        onHowToPlay={() => setScreen('help')}
        coachTips={coachTips}
        onCoachTips={(on) => {
          writeCoachTips(on)
          setCoachTips(on)
        }}
      />,
    )
  }

  if (rummyLocal || rummyPeer?.state || rummyPlay) {
    const ctrl = rummyLocal || rummyPeer
    return wrap(
      <RummyBoard
        yourName={name}
        variant={rummyVariant}
        playerCount={rummyPlayerCount}
        controller={
          ctrl
            ? {
                state: ctrl.state!,
                localIndex: ctrl.localIndex,
                aiThinking: ctrl.aiThinking,
                submit: (m) => ctrl.submit(m),
                nextHand: () => ctrl.nextHand(),
                newMatch: rummyLocal ? () => rummyLocal.newMatch() : undefined,
                onChange: (cb) => ctrl.onChange(cb),
              }
            : null
        }
        onExit={() => void leaveToMenu(true)}
      />,
    )
  }

  if (screen === 'menu') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Art Deco parlor</p>
          <h1>Hand &amp; Foot / Canasta</h1>
          <p>The table that teaches itself. Rank-grouped hands, a live meld meter, and books that snap shut in gold.</p>
          <button type="button" className="btn primary" onClick={() => setScreen('setup')}>
            Play Solo vs Computer
          </button>
          <p className="muted">Multiplayer is only at a Canasta table in Second Life. This page is solo vs computer.</p>
          <button type="button" className="btn ghost" onClick={() => setScreen('help')}>
            How to Play
          </button>
        </div>
      </div>,
    )
  }

  if (screen === 'help') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card wide help-card">
          <HowToPlay onClose={() => setScreen(tableHud ? 'sl' : 'menu')} closeLabel="Back" />
        </div>
      </div>,
    )
  }

  if (screen === 'setup') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Solo</p>
          <h2>Set the table</h2>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Game
            <VariantSelect value={variant} onChange={setVariant} />
          </label>
          {isBetaVariant(variant) ? <BetaVariantNotice /> : null}
          {isSambaFamily(variant) ? <HouseRulesPreview house={house} variant={variant} /> : null}
          <label className="check">
            <input type="checkbox" checked={partnership} onChange={(e) => setPartnership(e.target.checked)} />
            Play with an AI partner vs two AI (recommended)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={coachTips}
              onChange={(e) => {
                writeCoachTips(e.target.checked)
                setCoachTips(e.target.checked)
              }}
            />
            Coach — tips on how to play
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AiDifficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="sharp">Sharp</option>
            </select>
          </label>
          {isHouseRulesHandAndFoot(variant) ? (
            <>
              <HouseRulesPreview house={house} variant={variant} />
              <HandAndFootHouseFields house={house} onChange={setHouse} />
            </>
          ) : null}
          <button type="button" className="btn primary" onClick={() => void startLocal()}>
            Deal
          </button>
          <button type="button" className="btn ghost" onClick={() => setScreen('menu')}>
            Back
          </button>
        </div>
      </div>,
    )
  }

  if (!state) return wrap(<div className="shell-menu" />)

  const me = state.players[localIndex]!
  const byId = new Map(me.hand.map((c) => [c.id, c]))
  const selectedIds = new Set(meldGroups.flat())
  const parkedIds = new Set(
    meldGroups.flatMap((ids) => {
      const cards = ids.map((id) => byId.get(id)).filter((c): c is (typeof me.hand)[number] => Boolean(c))
      if (cards.length < 3) return []
      return ids
    }),
  )
  const toggle = (id: string) => {
    const card = byId.get(id)
    if (!card) return
    setMeldGroups((prev) => addCardToGroups(prev, card, byId, state.config))
  }
  const toggleRank = (ids: string[]) => {
    setMeldGroups((prev) => addRankToGroups(prev, ids, byId, state.config))
  }

  return wrap(
    <GameBoard
      state={state}
      localIndex={localIndex}
      selectedIds={selectedIds}
      parkedIds={parkedIds}
      meldGroups={meldGroups}
      aiThinking={aiThinking}
      onToggle={toggle}
      onToggleRank={toggleRank}
      onDraw={() => submit({ kind: 'drawStock' })}
      onTakePile={() => {
        const plan = planPileTake(state, localIndex, [...selectedIds])
        if (plan.ok && plan.cardIds !== undefined) submit({ kind: 'takePile', cardIds: plan.cardIds })
        else push(!plan.ok ? plan.error : 'Select two matching naturals, or the pile is stopped.')
      }}
      onTakeSequenceTop={(meldIndex) => submit({ kind: 'takeSequenceTop', meldIndex })}
      onPass={() => submit({ kind: 'pass' })}
      onMeld={() =>
        submit({
          kind: 'meld',
          cardIds: meldGroups.flat(),
          groups: meldGroups,
        })
      }
      onAdd={(meldIndex, cardIds) =>
        submit({ kind: 'addToMeld', meldIndex, cardIds: cardIds ?? [...selectedIds] })
      }
      onDiscard={() => {
        const id = [...selectedIds][0] ?? me.hand[0]?.id
        if (id) submit({ kind: 'discard', cardId: id })
      }}
      onClear={() => setMeldGroups([])}
      onDropGroup={(index) => setMeldGroups((prev) => prev.filter((_, i) => i !== index))}
      onMenu={() => void leaveToMenu(state.phase === 'matchEnd')}
      onContinue={() => submit({ kind: 'continue' })}
      onConsent={(accept) => submit({ kind: 'consentGoOut', accept })}
      onRequestGoOut={() => submit({ kind: 'requestGoOutConsent' })}
      onGoOut={() => submit({ kind: 'goOut' })}
      showOppBooks={showOppBooks}
      showOurBooks={showOurBooks}
      coachTips={Boolean(local) && coachTips}
      disconnectWait={
        disconnectWait
          ? { name: disconnectWait.name, until: disconnectWait.until }
          : null
      }
      waitSecondsLeft={disconnectWait ? secondsLeft(disconnectWait.until, waitNow) : 0}
      onQuitWaiting={() => {
        clearMatchResume()
        peer?.quitWaiting()
        void leaveToMenu(true)
      }}
    />,
  )
}
