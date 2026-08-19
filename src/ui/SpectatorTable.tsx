import { useEffect, useRef, useState } from 'react'
import { isWild, rankLabel } from '../core/cards'
import {
  decodePublicBoard,
  idlePublicBoard,
  publicMeldsAsEngine,
  spectatorConfig,
  type PublicBoard,
  type PublicPlayer,
} from '../core/publicBoard'
import { tableGetBoard, tableStatus } from '../sl/tableApi'
import { CardView } from './CardView'
import { MeldTray } from './MeldTray'
import { TableFlyLayer } from './TableFlyLayer'
import { applyUiScale } from './uiScale'

type Props = {
  slCap: string
}

function playerAt(board: PublicBoard, seat: number): PublicPlayer | undefined {
  return board.players.find((p) => p.seat === seat)
}

function whoLabel(board: PublicBoard, seat: number): string {
  const p = playerAt(board, seat)
  if (p?.name) return `${p.name} (Player ${seat + 1})`
  return `Player ${seat + 1}`
}

function SeatChip({ board, seat, label }: { board: PublicBoard; seat: number; label: string }) {
  const p = playerAt(board, seat)
  const vacant = !p
  const isTurn = board.live && board.currentSeat === seat
  const partnerNote = seat === 0 || seat === 2 ? 'Team 1+3' : 'Team 2+4'
  return (
    <div className={`spec-seat ${isTurn ? 'is-turn' : ''} ${vacant ? 'is-vacant' : ''}`} data-seat={seat}>
      <span className="spec-seat-num">
        Player {seat + 1} · {label}
      </span>
      <strong>{vacant ? '—' : p.name}</strong>
      {vacant ? (
        <span className="muted tiny">Empty</span>
      ) : (
        <>
          <span>{p.handCount} in hand (hidden)</span>
          {p.foot === 0 ? <span>Foot sealed</span> : null}
          {p.foot === 1 ? <span>Foot open</span> : null}
          <em>{partnerNote}</em>
        </>
      )}
      {isTurn ? <span className="turn-pill">Turn</span> : null}
    </div>
  )
}

function phaseLine(board: PublicBoard): string {
  if (!board.live) return 'The parlor is open — waiting for a deal'
  const who = whoLabel(board, board.currentSeat)
  if (board.phase === 'awaitingDraw') return `${who} is drawing…`
  if (board.phase === 'awaitingPlay') return `${who} is playing — meld or discard`
  if (board.phase === 'awaitingGoOutConsent') return `${who} asked to go out — waiting on partner`
  if (board.phase === 'roundEnd') return 'Hand over — scoring'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || 'Canasta'
}

export function SpectatorTable({ slCap }: Props) {
  const [board, setBoard] = useState<PublicBoard>(idlePublicBoard)
  const [linkOk, setLinkOk] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyUiScale(0.78)
  }, [])

  useEffect(() => {
    if (!slCap) return
    let alive = true
    let inflight = false
    const applyRaw = (raw: string | undefined) => {
      if (!raw || !raw.trim()) {
        setBoard(idlePublicBoard())
        return true
      }
      const next = decodePublicBoard(raw)
      setBoard(next.live ? next : idlePublicBoard())
      return true
    }
    const tick = async () => {
      if (inflight) return
      inflight = true
      try {
        const st = await tableStatus(slCap, 'spec', 0)
        if (!alive) return
        setLinkOk(true)
        if (st.mode === 'idle' || st.mode === 'resetting') {
          setBoard(idlePublicBoard())
          inflight = false
          return
        }
        if (applyRaw(st.board)) {
          inflight = false
          return
        }
        const res = await tableGetBoard(slCap)
        if (!alive) return
        applyRaw(res.board)
      } catch {
        if (alive) setLinkOk(false)
      }
      inflight = false
    }
    void tick()
    const id = window.setInterval(() => void tick(), 1000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [slCap])

  const config = spectatorConfig(board)
  const variant = board.variant === 'canasta' ? 'Canasta' : 'Hand & Foot'
  const roundLine = board.variant === 'handAndFoot' ? `R${board.round}/4` : board.playTo ? `to ${board.playTo}` : ''
  const top = board.top ? { id: 'spec-top', rank: board.top.rank, suit: board.top.suit } : null
  const sideways = Boolean(top && (isWild(top) || board.frozen))

  return (
    <div className={`spectator-root ${board.live ? 'is-live' : ''}`} ref={rootRef}>
      <div className="table-felt" />
      <div className="table-brass" />
      <TableFlyLayer board={board} rootRef={rootRef} />

      <header className="spec-banner">
        <div className="brand-mark">
          <span>CANASTA</span>
          <small>{board.live ? 'TABLE TOP · PLAYER 1 VIEW' : 'HAND & FOOT / CANASTA'}</small>
        </div>
        {board.live ? (
          <div className="score-ticker">
            <div>
              <em>1+3</em> {board.teams[0]!.score}
            </div>
            <div>
              <em>2+4</em> {board.teams[1]!.score}
            </div>
            <div>
              <em>{variant}</em> {roundLine}
            </div>
          </div>
        ) : null}
      </header>

      <p className="spec-turn">{phaseLine(board)}</p>
      {board.live && board.lastMessage ? <p className="spec-msg">{board.lastMessage}</p> : null}
      {!slCap || !linkOk ? <p className="spec-msg">Waiting for the table link…</p> : null}

      {board.live ? (
        <div className="spec-grid">
          <div className="spec-north">
            <SeatChip board={board} seat={2} label="opposite" />
          </div>
          <div className="spec-them" data-team-tray="1">
            <MeldTray
              title="Players 2 & 4 — books"
              melds={publicMeldsAsEngine(board.teams[1]!.melds)}
              config={config}
              redThrees={board.teams[1]!.redThrees}
            />
          </div>
          <div className="spec-west">
            <SeatChip board={board} seat={3} label="left" />
          </div>
          <div className="spec-mid">
            <div className="piles spec-piles">
              <div className="pile-slot" data-stock-pile>
                <span className="pile-label">Stock · {board.stock}</span>
                <CardView facedown size="lg" />
              </div>
              <div className={`pile-slot discard ${board.frozen ? 'is-frozen' : ''}`} data-discard-pile>
                <span className="pile-label">
                  Discard · {board.discardCount}
                  {board.frozen ? ' · frozen' : ''}
                </span>
                {top ? (
                  <div className={sideways ? 'side-wrap' : undefined}>
                    <CardView card={top} size="lg" sideways={sideways} />
                  </div>
                ) : (
                  <div className="pile-empty">Empty</div>
                )}
                {top ? <span className="preview">{rankLabel(top.rank)}</span> : null}
              </div>
            </div>
          </div>
          <div className="spec-east">
            <SeatChip board={board} seat={1} label="right" />
          </div>
          <div className="spec-us" data-team-tray="0">
            <MeldTray
              title="Players 1 & 3 — books"
              melds={publicMeldsAsEngine(board.teams[0]!.melds)}
              config={config}
              redThrees={board.teams[0]!.redThrees}
              highlight
            />
          </div>
          <div className="spec-south">
            <SeatChip board={board} seat={0} label="this side" />
          </div>
        </div>
      ) : (
        <div className="spec-parlor">
          <p className="brand-kicker">Art Deco parlor</p>
          <h2>Sit to play</h2>
          <p>Partners sit across: 1 with 3, 2 with 4. The felt waits for the next deal.</p>
        </div>
      )}
    </div>
  )
}
