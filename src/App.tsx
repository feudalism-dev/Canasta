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
import { TrickBoard } from './ui/TrickBoard'
import { IchiBoard } from './ui/IchiBoard'
import { SkippoBoard } from './ui/SkippoBoard'
import { SlTableScreens } from './ui/SlTableScreens'
import { ParkedHud } from './ui/ParkedHud'
import { Scoreboard } from './ui/Scoreboard'
import { SpectatorTable } from './ui/SpectatorTable'
import { resolveTableFamily, type GameFamily } from './core/family'
import type { RummyVariant } from './core/rummy/types'
import type { TrickVariant } from './core/trick/types'
import type { IchiVariant } from './core/ichi/types'
import type { SkippoVariant } from './core/skippo/types'
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
import {
  createTrickPeerHost,
  joinTrickPeerRoom,
  type TrickPeerSession,
} from './net/trickPeerSession'
import {
  createIchiPeerHost,
  joinIchiPeerRoom,
  type IchiPeerSession,
} from './net/ichiPeerSession'
import {
  createSkippoPeerHost,
  joinSkippoPeerRoom,
  type SkippoPeerSession,
} from './net/skippoPeerSession'
import { startRummySolo, type RummyLocalSession } from './ui/rummyLocalSession'
import { startTrickSolo, type TrickLocalSession } from './ui/trickLocalSession'
import { startIchiSolo, type IchiLocalSession } from './ui/ichiLocalSession'
import { startSkippoSolo, type SkippoLocalSession } from './ui/skippoLocalSession'
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
import { emitTrickDisplay, resetTrickDisplaySync } from './sl/trickDisplaySync'
import { syncIchiDisplay, resetIchiDisplaySync } from './sl/ichiDisplaySync'
import { syncSkippoDisplay, resetSkippoDisplaySync } from './sl/skippoDisplaySync'
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
  const urlPlay = (() => {
    try {
      return new URL(window.location.href).searchParams.get('play') || ''
    } catch {
      return ''
    }
  })()
  const urlPlayRummy = urlPlay === 'rummy'
  const urlPlayHearts = urlPlay === 'hearts' || urlPlay === 'trick'
  const urlPlayIchi = urlPlay === 'ichi'
  const urlPlaySkippo = urlPlay === 'skippo'
  const [screen, setScreen] = useState<Screen>(
    tableHud || seatedBrowser
      ? 'sl'
      : urlPlayRummy || urlPlayHearts || urlPlayIchi || urlPlaySkippo
        ? 'game'
        : 'menu',
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
  const [trickVariant, setTrickVariant] = useState<TrickVariant>('hearts')
  const [trickPlayerCount, setTrickPlayerCount] = useState(4)
  const [trickPlay, setTrickPlay] = useState(urlPlayHearts)
  const [trickLocal, setTrickLocal] = useState<TrickLocalSession | null>(null)
  const [trickPeer, setTrickPeer] = useState<TrickPeerSession | null>(null)
  const [ichiVariant, setIchiVariant] = useState<IchiVariant>('classic')
  const [ichiPlayerCount, setIchiPlayerCount] = useState(4)
  const [ichiPlay, setIchiPlay] = useState(urlPlayIchi)
  const [ichiLocal, setIchiLocal] = useState<IchiLocalSession | null>(null)
  const [ichiPeer, setIchiPeer] = useState<IchiPeerSession | null>(null)
  const [skippoVariant, setSkippoVariant] = useState<SkippoVariant>('classic')
  const [skippoPlayerCount, setSkippoPlayerCount] = useState(4)
  const [skippoPlay, setSkippoPlay] = useState(urlPlaySkippo)
  const [skippoLocal, setSkippoLocal] = useState<SkippoLocalSession | null>(null)
  const [skippoPeer, setSkippoPeer] = useState<SkippoPeerSession | null>(null)
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
    const trickUi = family === 'trick' || trickPlay || Boolean(trickLocal) || Boolean(trickPeer)
    const ichiUi = family === 'ichi' || ichiPlay || Boolean(ichiLocal) || Boolean(ichiPeer)
    const skippoUi = family === 'skippo' || skippoPlay || Boolean(skippoLocal) || Boolean(skippoPeer)
    const hideCanastaChrome = rummyUi || trickUi || ichiUi || skippoUi
    return (
      <div className="app-frame" style={{ '--felt': '#0c1f18' } as CSSProperties}>
        <AppChrome
          slBoot={tableHud || seatedBrowser || slBoot?.parked ? slBoot : null}
          parked={Boolean(slBoot?.parked)}
          roomCode={
            skippoPeer?.roomCode ||
            ichiPeer?.roomCode ||
            trickPeer?.roomCode ||
            rummyPeer?.roomCode ||
            peer?.roomCode ||
            slBoot?.room
          }
          showOppBooks={showOppBooks}
          onShowOppBooks={
            hideCanastaChrome
              ? undefined
              : (on) => {
                  writeOppBooks(on)
                  setShowOppBooks(on)
                }
          }
          showOurBooks={showOurBooks}
          onShowOurBooks={
            hideCanastaChrome
              ? undefined
              : (on) => {
                  writeOurBooks(on)
                  setShowOurBooks(on)
                }
          }
          coachTips={!hideCanastaChrome && Boolean(local) && screen === 'game' ? coachTips : undefined}
          onCoachTips={
            !hideCanastaChrome && local && screen === 'game'
              ? (on) => {
                  writeCoachTips(on)
                  setCoachTips(on)
                }
              : undefined
          }
          onMenu={
            screen === 'game' &&
            (state ||
              rummyPlay ||
              rummyLocal ||
              rummyPeer?.state ||
              trickPlay ||
              trickLocal ||
              trickPeer?.state ||
              ichiPlay ||
              ichiLocal ||
              ichiPeer?.state ||
              skippoPlay ||
              skippoLocal ||
              skippoPeer?.state)
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
    if (
      (peer?.state ||
        rummyPeer?.state ||
        rummyLocal ||
        trickLocal ||
        trickPeer?.state ||
        ichiLocal ||
        ichiPeer?.state ||
        skippoLocal ||
        skippoPeer?.state) &&
      screen === 'sl'
    )
      setScreen('game')
  }, [
    peer?.state,
    rummyPeer?.state,
    rummyLocal,
    trickLocal,
    trickPeer?.state,
    ichiLocal,
    ichiPeer?.state,
    skippoLocal,
    skippoPeer?.state,
    screen,
    tick,
  ])

  useEffect(() => {
    if (!rummyPeer) return
    return rummyPeer.onChange(() => setTick((t) => t + 1))
  }, [rummyPeer])

  useEffect(() => {
    if (!rummyLocal) return
    return rummyLocal.onChange(() => setTick((t) => t + 1))
  }, [rummyLocal])

  useEffect(() => {
    if (!trickLocal) return
    return trickLocal.onChange(() => setTick((t) => t + 1))
  }, [trickLocal])

  useEffect(() => {
    if (!trickPeer) return
    return trickPeer.onChange(() => setTick((t) => t + 1))
  }, [trickPeer])

  useEffect(() => {
    if (!trickPeer || trickPeer.isHost) return
    setTrickVariant(trickPeer.variant)
    setTrickPlayerCount(trickPeer.playerCount)
  }, [trickPeer, tick])

  useEffect(() => {
    if (!ichiLocal) return
    return ichiLocal.onChange(() => setTick((t) => t + 1))
  }, [ichiLocal])

  useEffect(() => {
    if (!ichiPeer) return
    return ichiPeer.onChange(() => setTick((t) => t + 1))
  }, [ichiPeer])

  useEffect(() => {
    if (!ichiPeer || ichiPeer.isHost) return
    setIchiVariant(ichiPeer.variant)
    setIchiPlayerCount(ichiPeer.playerCount)
  }, [ichiPeer, tick])

  useEffect(() => {
    if (!skippoLocal) return
    return skippoLocal.onChange(() => setTick((t) => t + 1))
  }, [skippoLocal])

  useEffect(() => {
    if (!skippoPeer) return
    return skippoPeer.onChange(() => setTick((t) => t + 1))
  }, [skippoPeer])

  useEffect(() => {
    if (!skippoPeer || skippoPeer.isHost) return
    setSkippoVariant(skippoPeer.variant)
    setSkippoPlayerCount(skippoPeer.playerCount)
  }, [skippoPeer, tick])

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

  useEffect(() => {
    const trickState = trickLocal?.state ?? trickPeer?.state
    if (!trickState || !tableHud || !slBoot?.slCap) return
    const isEmitter = Boolean(trickLocal) || trickPeer?.isHost === true
    if (!isEmitter) return
    emitTrickDisplay(trickState, slBoot.slCap, slBoot.uid, slBoot.seat)
  }, [tick, trickLocal, trickPeer, slBoot, tableHud])

  useEffect(() => {
    const ichiState = ichiLocal?.state ?? ichiPeer?.state
    if (!ichiState || !tableHud || !slBoot?.slCap) return
    const isEmitter = Boolean(ichiLocal) || ichiPeer?.isHost === true
    if (!isEmitter) return
    syncIchiDisplay(ichiState, slBoot.slCap, slBoot.uid, slBoot.seat)
  }, [tick, ichiLocal, ichiPeer, slBoot, tableHud])

  useEffect(() => {
    const skippoState = skippoLocal?.state ?? skippoPeer?.state
    if (!skippoState || !tableHud || !slBoot?.slCap) return
    const isEmitter = Boolean(skippoLocal) || skippoPeer?.isHost === true
    if (!isEmitter) return
    syncSkippoDisplay(skippoState, slBoot.slCap, slBoot.uid, slBoot.seat)
  }, [tick, skippoLocal, skippoPeer, slBoot, tableHud])

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
    trickLocal?.destroy()
    trickPeer?.destroy()
    ichiLocal?.destroy()
    ichiPeer?.destroy()
    skippoLocal?.destroy()
    skippoPeer?.destroy()
    if (family === 'skippo') {
      if (tableHud && slBoot?.slCap) {
        try {
          await tableClaimSolo(slBoot.slCap, slBoot.uid, slBoot.seat, skippoPlayerCount)
        } catch (e) {
          push(e instanceof Error ? e.message : 'Could not claim table')
        }
      }
      const humanSeat = tableHud && slBoot && slBoot.seat >= 0 ? slBoot.seat : 0
      const ctrl = startSkippoSolo(name, skippoPlayerCount, skippoVariant, humanSeat)
      resetSkippoDisplaySync()
      setLocal(null)
      setPeer(null)
      setRummyPeer(null)
      setRummyLocal(null)
      setTrickPeer(null)
      setTrickLocal(null)
      setIchiPeer(null)
      setIchiLocal(null)
      setSkippoPeer(null)
      setSkippoLocal(ctrl)
      setRummyPlay(false)
      setTrickPlay(false)
      setIchiPlay(false)
      setSkippoPlay(false)
      slMatchKind.current = tableHud ? 'solo' : 'none'
      setScreen('game')
      push(
        `Skippo solo — ${skippoPlayerCount} players (you + ${skippoPlayerCount - 1} bot${skippoPlayerCount > 2 ? 's' : ''}).`,
      )
      return
    }
    if (family === 'ichi') {
      if (tableHud && slBoot?.slCap) {
        try {
          await tableClaimSolo(slBoot.slCap, slBoot.uid, slBoot.seat, ichiPlayerCount)
        } catch (e) {
          push(e instanceof Error ? e.message : 'Could not claim table')
        }
      }
      const humanSeat = tableHud && slBoot && slBoot.seat >= 0 ? slBoot.seat : 0
      const ctrl = startIchiSolo(name, ichiPlayerCount, ichiVariant, humanSeat)
      resetIchiDisplaySync()
      setLocal(null)
      setPeer(null)
      setRummyPeer(null)
      setRummyLocal(null)
      setTrickPeer(null)
      setTrickLocal(null)
      setSkippoPeer(null)
      setSkippoLocal(null)
      setIchiPeer(null)
      setIchiLocal(ctrl)
      setRummyPlay(false)
      setTrickPlay(false)
      setIchiPlay(false)
      setSkippoPlay(false)
      slMatchKind.current = tableHud ? 'solo' : 'none'
      setScreen('game')
      push(
        `Ichi solo — ${ichiPlayerCount} players (you + ${ichiPlayerCount - 1} bot${ichiPlayerCount > 2 ? 's' : ''}).`,
      )
      return
    }
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
      setTrickPeer(null)
      setTrickLocal(null)
      setIchiPeer(null)
      setIchiLocal(null)
      setRummyLocal(ctrl)
      setRummyPlay(false)
      setIchiPlay(false)
      setSkippoPlay(false)
      slMatchKind.current = tableHud ? 'solo' : 'none'
      setScreen('game')
      push(`Rummy solo — ${rummyPlayerCount} players (you + ${rummyPlayerCount - 1} bot${rummyPlayerCount > 2 ? 's' : ''}).`)
      return
    }
    if (family === 'trick') {
      const ready = ['hearts', 'rooster', 'spades', 'euchre', 'ohhell']
      if (!ready.includes(trickVariant)) {
        push('That trick game is coming soon.')
        return
      }
      const seats =
        trickVariant === 'hearts' || trickVariant === 'ohhell' ? trickPlayerCount : 4
      if (tableHud && slBoot?.slCap) {
        try {
          await tableClaimSolo(slBoot.slCap, slBoot.uid, slBoot.seat, seats)
        } catch (e) {
          push(e instanceof Error ? e.message : 'Could not claim table')
        }
      }
      const humanSeat = tableHud && slBoot && slBoot.seat >= 0 ? slBoot.seat : 0
      const ctrl = startTrickSolo(name, seats, trickVariant, humanSeat)
      resetTrickDisplaySync()
      setLocal(null)
      setPeer(null)
      setRummyPeer(null)
      setRummyLocal(null)
      setTrickPeer(null)
      setTrickLocal(ctrl)
      setIchiLocal(null)
      setIchiPeer(null)
      setRummyPlay(false)
      setTrickPlay(false)
      setIchiPlay(false)
      setSkippoPlay(false)
      slMatchKind.current = tableHud ? 'solo' : 'none'
      setScreen('game')
      const labels: Record<string, string> = {
        hearts: `Hearts solo — ${seats} players (you + ${seats - 1} bot${seats > 2 ? 's' : ''}).`,
        rooster: 'Rooster solo — you + 3 bots, partners across (1+3 vs 2+4).',
        spades: 'Spades solo — you + 3 bots, partners across (1+3 vs 2+4).',
        euchre: 'Euchre solo — you + 3 bots, partners across (1+3 vs 2+4).',
        ohhell: `Oh Hell solo — ${seats} players (you + ${seats - 1} bot${seats > 2 ? 's' : ''}).`,
      }
      push(labels[trickVariant] ?? 'Trick solo started.')
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
    setTrickLocal(null)
    setTrickPeer(null)
    setIchiLocal(null)
    setIchiPeer(null)
    setRummyPlay(false)
    setTrickPlay(false)
    setIchiPlay(false)
    setSkippoPlay(false)
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
    trickLocal?.destroy()
    trickPeer?.destroy()
    ichiLocal?.destroy()
    ichiPeer?.destroy()
    skippoLocal?.destroy()
    skippoPeer?.destroy()
    setPeer(null)
    setLocal(null)
    setRummyPeer(null)
    setRummyLocal(null)
    setTrickLocal(null)
    setTrickPeer(null)
    setIchiLocal(null)
    setIchiPeer(null)
    setSkippoLocal(null)
    setSkippoPeer(null)
    setRummyPlay(false)
    setTrickPlay(false)
    setIchiPlay(false)
    setSkippoPlay(false)
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
    !rummyPeer?.state &&
    !trickLocal &&
    !trickPeer?.state &&
    !ichiLocal &&
    !ichiPeer?.state &&
    !skippoLocal &&
    !skippoPeer?.state
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
          if (v === 'gin' || v === 'oklahoma') setRummyPlayerCount(2)
          rummyPeer?.setVariant(v)
        }}
        rummyPlayerCount={rummyVariant === 'gin' || rummyVariant === 'oklahoma' ? 2 : rummyPlayerCount}
        onRummyPlayerCount={(n) => {
          const next = rummyVariant === 'gin' || rummyVariant === 'oklahoma' ? 2 : n
          setRummyPlayerCount(next)
          rummyPeer?.setPlayerCount(next)
        }}
        trickVariant={trickVariant}
        onTrickVariant={(v) => {
          setTrickVariant(v)
          if (v !== 'hearts' && v !== 'ohhell') {
            setTrickPlayerCount(4)
            trickPeer?.setPlayerCount(4)
          }
          trickPeer?.setVariant(v)
        }}
        trickPlayerCount={
          trickVariant === 'hearts' || trickVariant === 'ohhell' ? trickPlayerCount : 4
        }
        onTrickPlayerCount={(n) => {
          const next = trickVariant === 'hearts' || trickVariant === 'ohhell' ? n : 4
          setTrickPlayerCount(next)
          trickPeer?.setPlayerCount(next)
        }}
        onFamily={setFamily}
        partnership={partnership}
        onPartnership={setPartnership}
        onStartSolo={startLocal}
        onResumeMatch={() => void tryResumeSavedMatch()}
        canResumeMatch={Boolean(
          slBoot &&
            family !== 'rummy' &&
            family !== 'trick' &&
            family !== 'ichi' &&
            family !== 'skippo' &&
            loadMatchResume({ uid: slBoot.uid, seat: slBoot.seat, tableId: slBoot.tableId }),
        )}
        ichiVariant={ichiVariant}
        onIchiVariant={(v) => {
          setIchiVariant(v)
          ichiPeer?.setVariant(v)
        }}
        ichiPlayerCount={ichiPlayerCount}
        onIchiPlayerCount={(n) => {
          setIchiPlayerCount(n)
          ichiPeer?.setPlayerCount(n)
        }}
        skippoVariant={skippoVariant}
        onSkippoVariant={(v) => {
          setSkippoVariant(v)
          skippoPeer?.setVariant(v)
        }}
        skippoPlayerCount={skippoPlayerCount}
        onSkippoPlayerCount={(n) => {
          setSkippoPlayerCount(n)
          skippoPeer?.setPlayerCount(n)
        }}
        onCreatedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          rummyPeer?.destroy()
          trickPeer?.destroy()
          ichiPeer?.destroy()
          skippoPeer?.destroy()
          if (family === 'skippo') {
            const session = await createSkippoPeerHost(name, {
              roomCode,
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
              variant: skippoVariant,
              playerCount: skippoPlayerCount,
            })
            resetSkippoDisplaySync()
            setSkippoPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setTrickLocal(null)
            setIchiPeer(null)
            setIchiLocal(null)
            setSkippoLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'ichi') {
            const session = await createIchiPeerHost(name, {
              roomCode,
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
              variant: ichiVariant,
              playerCount: ichiPlayerCount,
            })
            resetIchiDisplaySync()
            setIchiPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setTrickLocal(null)
            setIchiLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'trick') {
            const readyMp = ['hearts', 'rooster', 'spades', 'euchre', 'ohhell']
            if (!readyMp.includes(trickVariant)) {
              push('That trick game is coming soon.')
              return
            }
            const session = await createTrickPeerHost(name, {
              roomCode,
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
              variant: trickVariant,
              playerCount:
                trickVariant === 'hearts' || trickVariant === 'ohhell' ? trickPlayerCount : 4,
            })
            resetTrickDisplaySync()
            setTrickPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickLocal(null)
            slMatchKind.current = 'mp'
            return
          }
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
            setTrickPeer(null)
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
          setTrickPeer(null)
          slMatchKind.current = 'mp'
        }}
        onJoinedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          rummyPeer?.destroy()
          trickPeer?.destroy()
          ichiPeer?.destroy()
          skippoPeer?.destroy()
          if (family === 'skippo') {
            const session = await joinSkippoPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setSkippoPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setTrickLocal(null)
            setIchiPeer(null)
            setIchiLocal(null)
            setSkippoLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'ichi') {
            const session = await joinIchiPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setIchiPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setTrickLocal(null)
            setIchiLocal(null)
            setSkippoPeer(null)
            setSkippoLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'trick') {
            const session = await joinTrickPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setTrickPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickLocal(null)
            setIchiPeer(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'rummy') {
            const session = await joinRummyPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setRummyPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setIchiPeer(null)
            slMatchKind.current = 'mp'
            return
          }
          const session = await joinPeerRoom(roomCode, name, { avatarUid: slBoot.uid, seat: slBoot.seat })
          setPeer(session)
          setLocal(null)
          setRummyPeer(null)
          setRummyLocal(null)
          setTrickPeer(null)
          setIchiPeer(null)
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
          if (family === 'skippo') {
            skippoPeer?.startMatch(occupants)
          } else if (family === 'ichi') {
            ichiPeer?.startMatch(occupants)
          } else if (family === 'trick') {
            trickPeer?.startMatch(occupants)
          } else if (family === 'rummy') {
            rummyPeer?.startMatch(occupants)
          } else {
            peer?.startMatch(occupants)
          }
          setTick((t) => t + 1)
        }}
        onLeaveLobby={async () => {
          peer?.destroy()
          rummyPeer?.destroy()
          trickPeer?.destroy()
          ichiPeer?.destroy()
          skippoPeer?.destroy()
          setPeer(null)
          setRummyPeer(null)
          setTrickPeer(null)
          setIchiPeer(null)
          setSkippoPeer(null)
          slMatchKind.current = 'none'
        }}
        onDetachPeer={() => {
          peer?.destroy()
          rummyPeer?.destroy()
          trickPeer?.destroy()
          ichiPeer?.destroy()
          skippoPeer?.destroy()
          setPeer(null)
          setRummyPeer(null)
          setTrickPeer(null)
          setIchiPeer(null)
          setSkippoPeer(null)
          slMatchKind.current = 'none'
        }}
        peerHasState={Boolean(
          peer?.state || rummyPeer?.state || trickPeer?.state || ichiPeer?.state || skippoPeer?.state,
        )}
        onRejoinPeer={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          rummyPeer?.destroy()
          trickPeer?.destroy()
          ichiPeer?.destroy()
          skippoPeer?.destroy()
          if (family === 'skippo') {
            const session = await joinSkippoPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setSkippoPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setTrickLocal(null)
            setIchiPeer(null)
            setIchiLocal(null)
            setSkippoLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'ichi') {
            const session = await joinIchiPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setIchiPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setTrickLocal(null)
            setIchiLocal(null)
            setSkippoPeer(null)
            setSkippoLocal(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'trick') {
            const session = await joinTrickPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setTrickPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyPeer(null)
            setRummyLocal(null)
            setTrickLocal(null)
            setIchiPeer(null)
            slMatchKind.current = 'mp'
            return
          }
          if (family === 'rummy') {
            const session = await joinRummyPeerRoom(roomCode, name, {
              avatarUid: slBoot.uid,
              seat: slBoot.seat,
            })
            setRummyPeer(session)
            setPeer(null)
            setLocal(null)
            setRummyLocal(null)
            setTrickPeer(null)
            setIchiPeer(null)
            slMatchKind.current = 'mp'
            return
          }
          const session = await joinPeerRoom(roomCode, name, { avatarUid: slBoot.uid, seat: slBoot.seat })
          setPeer(session)
          setLocal(null)
          setRummyPeer(null)
          setRummyLocal(null)
          setTrickPeer(null)
          setIchiPeer(null)
          slMatchKind.current = 'mp'
        }}
        peerRoomCode={
          skippoPeer?.roomCode ||
          ichiPeer?.roomCode ||
          trickPeer?.roomCode ||
          rummyPeer?.roomCode ||
          peer?.roomCode
        }
        peerSeats={
          skippoPeer?.seats || ichiPeer?.seats || trickPeer?.seats || rummyPeer?.seats || peer?.seats
        }
        isPeerHost={
          skippoPeer?.isHost ??
          ichiPeer?.isHost ??
          trickPeer?.isHost ??
          rummyPeer?.isHost ??
          peer?.isHost
        }
        onPeerReadyToggle={(ready) => {
          skippoPeer?.setReady(ready)
          ichiPeer?.setReady(ready)
          trickPeer?.setReady(ready)
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

  if (skippoLocal || skippoPeer?.state || skippoPlay) {
    const ctrl = skippoLocal || skippoPeer
    return wrap(
      <SkippoBoard
        yourName={name}
        variant={skippoVariant}
        playerCount={skippoPlayerCount}
        controller={
          ctrl?.state
            ? {
                state: ctrl.state,
                localIndex: ctrl.localIndex,
                aiThinking: ctrl.aiThinking,
                submit: (m) => ctrl.submit(m),
                nextHand: () => ctrl.nextHand(),
                newMatch: skippoLocal ? () => skippoLocal.newMatch() : undefined,
                onChange: (cb) => ctrl.onChange(cb),
              }
            : null
        }
        onExit={() => void leaveToMenu(true)}
      />,
    )
  }

  if (ichiLocal || ichiPeer?.state || ichiPlay) {
    const ctrl = ichiLocal || ichiPeer
    return wrap(
      <IchiBoard
        yourName={name}
        variant={ichiVariant}
        playerCount={ichiPlayerCount}
        controller={
          ctrl?.state
            ? {
                state: ctrl.state,
                localIndex: ctrl.localIndex,
                aiThinking: ctrl.aiThinking,
                submit: (m) => ctrl.submit(m),
                nextHand: () => ctrl.nextHand(),
                newMatch: ichiLocal ? () => ichiLocal.newMatch() : undefined,
                onChange: (cb) => ctrl.onChange(cb),
              }
            : null
        }
        onExit={() => void leaveToMenu(true)}
      />,
    )
  }

  if (trickLocal || trickPeer?.state || trickPlay) {
    const ctrl = trickLocal || trickPeer
    return wrap(
      <TrickBoard
        yourName={name}
        variant={trickVariant}
        controller={
          ctrl?.state
            ? {
                state: ctrl.state,
                localIndex: ctrl.localIndex,
                aiThinking: ctrl.aiThinking,
                submit: (m) => ctrl.submit(m),
                nextHand: () => ctrl.nextHand(),
                newMatch: trickLocal ? () => trickLocal.newMatch() : undefined,
                onChange: (cb) => ctrl.onChange(cb),
              }
            : null
        }
        onExit={() => void leaveToMenu(true)}
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
