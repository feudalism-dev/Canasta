import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import './styles/parlor.css'
import { AppChrome } from './ui/AppChrome'
import { GameBoard } from './ui/GameBoard'
import { HowToPlay } from './ui/HowToPlay'
import { ParkedHud } from './ui/ParkedHud'
import { SlTableScreens } from './ui/SlTableScreens'
import { ToastManager, useToasts } from './ui/ToastManager'
import { startSolo, type LocalControllers } from './ui/localSession'
import type { AiDifficulty } from './ai/heuristic'
import { claimCardsForPile } from './core/rules'
import { cloneState } from './core/state'
import type { HouseRules, MatchState, Variant } from './core/types'
import { DEFAULT_HOUSE } from './core/types'
import { createPeerHost, joinPeerRoom, type PeerSession } from './net/peerSession'
import { readSlBootstrap } from './sl/bootstrap'
import { emitDisplayPipes } from './sl/displaySync'
import { tableClaimSolo, tableEndGame } from './sl/tableApi'

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
  const [screen, setScreen] = useState<Screen>(slBoot ? 'sl' : 'menu')
  const [name, setName] = useState(slBoot?.name || 'You')
  const [variant, setVariant] = useState<Variant>('canasta')
  const [partnership, setPartnership] = useState(true)
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [house, setHouse] = useState<HouseRules>({ ...DEFAULT_HOUSE })
  const [local, setLocal] = useState<LocalControllers | null>(null)
  const [peer, setPeer] = useState<PeerSession | null>(null)
  const [tick, setTick] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
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
    if (!local) return
    return local.onChange(() => setTick((t) => t + 1))
  }, [local])

  const state = local?.state ?? peer?.state ?? null
  const localIndex = local?.localIndex ?? peer?.localIndex ?? 0
  const aiThinking = local?.aiThinking ?? false

  const wrap = (node: ReactNode) => (
    <div className="app-frame" style={{ '--felt': '#0c1f18' } as CSSProperties}>
      <AppChrome
        slBoot={slBoot}
        parked={Boolean(slBoot?.parked)}
        roomCode={peer?.roomCode || slBoot?.room}
        onStatus={(msg) => {
          setStatus(msg)
          push(msg)
        }}
      />
      <div className="app-scale">{node}</div>
    </div>
  )

  useEffect(() => {
    if (peer?.state && screen === 'sl') setScreen('game')
  }, [peer?.state, screen, tick])

  useEffect(() => {
    if (!state?.lastMessage) return
    setStatus(state.lastMessage)
    if (state.lastMessage !== lastToast.current) {
      lastToast.current = state.lastMessage
      push(state.lastMessage)
    }
  }, [state?.lastMessage, tick, push])

  useEffect(() => {
    if (!state || !slBoot?.slCap) return
    const isEmitter = Boolean(local) || peer?.isHost === true
    if (!isEmitter || !lastMoveRef.current) {
      prevMatchRef.current = cloneState(state)
      return
    }
    void emitDisplayPipes(
      prevMatchRef.current,
      state,
      lastMoveRef.current.move,
      lastMoveRef.current.index,
      slBoot.slCap,
      slBoot.uid,
      slBoot.seat,
    )
    prevMatchRef.current = cloneState(state)
  }, [tick, state, local, peer, slBoot])

  const submit = (move: Parameters<LocalControllers['submit']>[0]) => {
    lastMoveRef.current = { move, index: localIndex }
    local?.submit(move)
    peer?.submit(move)
    setSelectedIds(new Set())
    setTick((t) => t + 1)
  }

  const startLocal = async () => {
    local?.destroy()
    peer?.destroy()
    if (slBoot?.slCap) {
      try {
        await tableClaimSolo(slBoot.slCap, slBoot.uid, slBoot.seat, partnership ? 4 : 2)
      } catch (e) {
        push(e instanceof Error ? e.message : 'Could not claim table')
      }
    }
    const ctrl = startSolo(name, variant, partnership, difficulty, house)
    prevMatchRef.current = null
    setLocal(ctrl)
    setPeer(null)
    slMatchKind.current = slBoot ? 'solo' : 'none'
    setScreen('game')
    push(ctrl.state.lastMessage)
  }

  const leaveToMenu = async () => {
    peer?.destroy()
    local?.destroy()
    setPeer(null)
    setLocal(null)
    if (slBoot?.slCap && slMatchKind.current !== 'none') {
      try {
        await tableEndGame(slBoot.slCap, slBoot.uid, slBoot.seat)
      } catch {
        /* ignore */
      }
    }
    slMatchKind.current = 'none'
    setScreen(slBoot ? 'sl' : 'menu')
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

  if (screen === 'sl' && slBoot && !state) {
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
        onVariant={setVariant}
        partnership={partnership}
        onPartnership={setPartnership}
        onStartSolo={startLocal}
        onCreatedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          const session = await createPeerHost(name, {
            roomCode,
            avatarUid: slBoot.uid,
            seat: slBoot.seat,
            variant,
            house,
          })
          setPeer(session)
          setLocal(null)
          slMatchKind.current = 'mp'
        }}
        onJoinedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          const session = await joinPeerRoom(roomCode, name, { avatarUid: slBoot.uid, seat: slBoot.seat })
          setPeer(session)
          setLocal(null)
          slMatchKind.current = 'mp'
        }}
        onHostStartMp={() => {
          peer?.setVariant(variant)
          peer?.startMatch()
          setTick((t) => t + 1)
        }}
        onLeaveLobby={async () => {
          peer?.destroy()
          setPeer(null)
          slMatchKind.current = 'none'
        }}
        peerRoomCode={peer?.roomCode}
        peerSeats={peer?.seats}
        isPeerHost={peer?.isHost}
        onPeerReady={() => peer?.setReady(true)}
        onHowToPlay={() => setScreen('help')}
      />,
    )
  }

  if (screen === 'menu') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Art Deco parlor</p>
          <h1>Canasta &amp; Hand and Foot</h1>
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
          <HowToPlay onClose={() => setScreen(slBoot ? 'sl' : 'menu')} closeLabel="Back" />
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
            <select value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
              <option value="canasta">Classic Canasta — to 5,000</option>
              <option value="handAndFoot">Hand and Foot — 4 rounds</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={partnership} onChange={(e) => setPartnership(e.target.checked)} />
            Play with an AI partner vs two AI (recommended)
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AiDifficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="sharp">Sharp</option>
            </select>
          </label>
          {variant === 'handAndFoot' ? (
            <>
              <label>
                Books to go out
                <select
                  value={`${house.goingOutClean}-${house.goingOutDirty}`}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '2-2') setHouse({ ...house, goingOutClean: 2, goingOutDirty: 2 })
                    else setHouse({ ...house, goingOutClean: 1, goingOutDirty: 1 })
                  }}
                >
                  <option value="1-1">1 clean + 1 dirty</option>
                  <option value="2-2">2 clean + 2 dirty</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={house.wildBooksAllowed}
                  onChange={(e) => setHouse({ ...house, wildBooksAllowed: e.target.checked })}
                />
                Allow wild books (+1500)
              </label>
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
  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleRank = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allOn = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allOn) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  return wrap(
    <GameBoard
      state={state}
      localIndex={localIndex}
      selectedIds={selectedIds}
      aiThinking={aiThinking}
      onToggle={toggle}
      onToggleRank={toggleRank}
      onDraw={() => submit({ kind: 'drawStock' })}
      onTakePile={() => {
        const claim = claimCardsForPile(state, localIndex)
        if (claim) submit({ kind: 'takePile', cardIds: claim })
        else push('Select two matching naturals, or the pile is stopped.')
      }}
      onMeld={() => submit({ kind: 'meld', cardIds: [...selectedIds] })}
      onAdd={(meldIndex) => submit({ kind: 'addToMeld', meldIndex, cardIds: [...selectedIds] })}
      onDiscard={() => {
        const id = [...selectedIds][0] ?? me.hand[0]?.id
        if (id) submit({ kind: 'discard', cardId: id })
      }}
      onClear={() => setSelectedIds(new Set())}
      onMenu={() => void leaveToMenu()}
      onContinue={() => submit({ kind: 'continue' })}
      onConsent={(accept) => submit({ kind: 'consentGoOut', accept })}
    />,
  )
}
