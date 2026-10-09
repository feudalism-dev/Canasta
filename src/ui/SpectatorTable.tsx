import { useEffect, useRef, useState } from 'react'
import { isWild, rankLabel, type Card } from '../core/cards'
import { normalizeFamily, type GameFamily } from '../core/family'
import {
  decodePublicBoard,
  idlePublicBoard,
  isIdleBoardPayload,
  publicMeldsAsEngine,
  spectatorConfig,
  type PublicBoard,
  type PublicPlayer,
} from '../core/publicBoard'
import {
  decodeRummyPublicBoard,
  idleRummyPublicBoard,
  isRummyBoardPayload,
  rummyVariantLabel,
  type RummyPublicBoard,
  type RummyPublicPlayer,
} from '../core/rummy/publicBoard'
import { isHandAndFoot, variantLabel } from '../core/houseRules'
import { tableGetBoard, tableStatus } from '../sl/tableApi'
import { CardView } from './CardView'
import { MeldTray } from './MeldTray'
import { TableFlyLayer } from './TableFlyLayer'
import { applyUiScale } from './uiScale'

type Props = {
  slCap: string
  /** From MoAP URL (`family=rummy`) or table status. */
  familyHint?: string
}

function playerAt(board: PublicBoard, seat: number): PublicPlayer | undefined {
  return board.players.find((p) => p.seat === seat)
}

function rummyPlayerAt(board: RummyPublicBoard, seat: number): RummyPublicPlayer | undefined {
  return board.players.find((p) => p.seat === seat)
}

function whoLabel(board: PublicBoard, seat: number): string {
  const p = playerAt(board, seat)
  if (p?.name) return `${p.name} (Player ${seat + 1})`
  return `Player ${seat + 1}`
}

function rummyWhoLabel(board: RummyPublicBoard, seat: number): string {
  const p = rummyPlayerAt(board, seat)
  if (p?.name) return `${p.name} (Player ${seat + 1})`
  return `Player ${seat + 1}`
}

function SeatChip({
  board,
  seat,
  label,
  family,
}: {
  board: PublicBoard
  seat: number
  label: string
  family: GameFamily
}) {
  const p = playerAt(board, seat)
  const vacant = !p
  const isTurn = board.live && board.currentSeat === seat
  const partnerNote = family === 'rummy' ? 'Seat' : seat === 0 || seat === 2 ? 'Team 1+3' : 'Team 2+4'
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
          {family === 'canasta' && p.foot === 0 ? <span>Foot sealed</span> : null}
          {family === 'canasta' && p.foot === 1 ? <span>Foot open</span> : null}
          <em>{partnerNote}</em>
        </>
      )}
      {isTurn ? <span className="turn-pill">Turn</span> : null}
    </div>
  )
}

function RummySeatChip({
  board,
  seat,
  label,
}: {
  board: RummyPublicBoard
  seat: number
  label: string
}) {
  const p = rummyPlayerAt(board, seat)
  const vacant = !p
  const isTurn = board.live && board.currentSeat === seat
  const melds = board.melds.filter((m) => m.seat === seat)
  return (
    <div className={`spec-seat-block ${isTurn ? 'is-turn' : ''} ${vacant ? 'is-vacant' : ''}`} data-seat={seat}>
      <div className={`spec-seat ${isTurn ? 'is-turn' : ''} ${vacant ? 'is-vacant' : ''}`}>
        <span className="spec-seat-num">
          Player {seat + 1} · {label}
        </span>
        <strong>{vacant ? '—' : p.name}</strong>
        {vacant ? (
          <span className="muted tiny">Empty</span>
        ) : (
          <>
            <span>
              {p.handCount} in hand · {p.score} pts
            </span>
            <em>Seat</em>
          </>
        )}
        {isTurn ? <span className="turn-pill">Turn</span> : null}
      </div>
      {melds.length > 0 ? (
        <div className="spec-rummy-melds" aria-label={`${p?.name ?? 'Seat'} melds`}>
          {melds.map((m, i) => (
            <div key={`${seat}-${i}`} className="spec-rummy-meld">
              <span className="muted tiny">{m.kind}</span>
              <div className="rummy-card-row">
                {m.cards.map((c: Card) => (
                  <CardView key={c.id} card={c} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function phaseLine(board: PublicBoard, family: GameFamily): string {
  if (!board.live) {
    return family === 'rummy' ? 'Rummy parlor open — waiting for a deal' : 'The parlor is open — waiting for a deal'
  }
  const who = whoLabel(board, board.currentSeat)
  if (board.phase === 'awaitingDraw') return `${who} is drawing…`
  if (board.phase === 'awaitingPlay') return `${who} is playing — meld or discard`
  if (board.phase === 'awaitingGoOutConsent') return `${who} asked to go out — waiting on partner`
  if (board.phase === 'roundEnd') return 'Hand over — scoring'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || (family === 'rummy' ? 'Rummy' : 'Canasta')
}

function rummyPhaseLine(board: RummyPublicBoard): string {
  if (!board.live) return 'Rummy parlor open — waiting for a deal'
  const who = rummyWhoLabel(board, board.currentSeat)
  if (board.phase === 'draw') return `${who} is drawing…`
  if (board.phase === 'meld' || board.phase === 'discard') {
    return `${who} is playing — meld or discard`
  }
  if (board.phase === 'roundEnd') return 'Hand over — scoring'
  if (board.phase === 'matchEnd') return 'Match over'
  return board.lastMessage || 'Rummy'
}

export function SpectatorTable({ slCap, familyHint = '' }: Props) {
  const [board, setBoard] = useState<PublicBoard>(idlePublicBoard)
  const [rummyBoard, setRummyBoard] = useState<RummyPublicBoard>(idleRummyPublicBoard)
  const [linkOk, setLinkOk] = useState(true)
  const [family, setFamily] = useState<GameFamily>(() => normalizeFamily(familyHint))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyUiScale(0.78)
  }, [])

  useEffect(() => {
    setFamily(normalizeFamily(familyHint))
  }, [familyHint])

  useEffect(() => {
    if (!slCap) return
    let alive = true
    let inflight = false
    const applyRaw = (raw: string | undefined) => {
      if (!raw || !raw.trim()) return false
      const text = raw.trim()
      if (isRummyBoardPayload(text)) {
        const next = decodeRummyPublicBoard(text)
        setRummyBoard(next)
        if (next.live) setBoard(idlePublicBoard())
        return true
      }
      const next = decodePublicBoard(text)
      if (next.live) {
        setBoard(next)
        setRummyBoard(idleRummyPublicBoard())
        return true
      }
      if (isIdleBoardPayload(text)) {
        setBoard(idlePublicBoard())
        setRummyBoard(idleRummyPublicBoard())
        return true
      }
      return false
    }
    const tick = async () => {
      if (inflight) return
      inflight = true
      try {
        const st = await tableStatus(slCap, 'spec', 0)
        if (!alive) return
        setLinkOk(true)
        if (st.family) setFamily(normalizeFamily(st.family))
        if (st.mode === 'idle' || st.mode === 'resetting') {
          setBoard(idlePublicBoard())
          setRummyBoard(idleRummyPublicBoard())
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

  const isRummy = family === 'rummy'
  const rummyLive = isRummy && rummyBoard.live
  const canastaLive = !isRummy && board.live
  const config = spectatorConfig(board)
  const variant = isRummy ? rummyVariantLabel(rummyBoard.variant) : variantLabel(board.variant)
  const roundLine = isRummy
    ? rummyBoard.handsPerMatch != null
      ? `H${rummyBoard.round}/${rummyBoard.handsPerMatch}`
      : rummyBoard.playTo != null
        ? `to ${rummyBoard.playTo}`
        : `H${rummyBoard.round}`
    : isHandAndFoot(board.variant)
      ? `R${board.round}/4`
      : board.playTo
        ? `to ${board.playTo}`
        : ''

  const topCard = rummyLive
    ? rummyBoard.top
      ? { id: 'spec-top', rank: rummyBoard.top.rank, suit: rummyBoard.top.suit }
      : null
    : board.top
      ? { id: 'spec-top', rank: board.top.rank, suit: board.top.suit }
      : null
  const stockCount = rummyLive ? rummyBoard.stock : board.stock
  const discardCount = rummyLive ? rummyBoard.discardCount : board.discardCount
  const frozen = !rummyLive && board.frozen
  const sideways = Boolean(topCard && (isWild(topCard) || frozen))

  return (
    <div
      className={`spectator-root ${rummyLive || canastaLive ? 'is-live' : ''}`}
      ref={rootRef}
    >
      <div className="table-felt" />
      <div className="table-brass" />
      {!isRummy ? <TableFlyLayer board={board} rootRef={rootRef} /> : null}

      {rummyLive || canastaLive ? (
        <>
          <header className="spec-banner">
            <div className="brand-mark">
              {isRummy ? (
                <>
                  <span>RUMMY</span>
                  <small>TABLE TOP · PLAYER 1 VIEW</small>
                </>
              ) : (
                <>
                  <span>HAND &amp; FOOT</span>
                  <small>TABLE TOP · PLAYER 1 VIEW</small>
                </>
              )}
            </div>
            <div className="score-ticker">
              {rummyLive ? (
                <>
                  <div>
                    <em>{variant}</em> {roundLine}
                  </div>
                  {rummyBoard.knockMax != null ? (
                    <div>
                      <em>knock</em> ≤{rummyBoard.knockMax}
                      {rummyBoard.scoreMult > 1 ? ' ×2' : ''}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div>
                    <em>1+3</em> {board.teams[0]!.score}
                  </div>
                  <div>
                    <em>2+4</em> {board.teams[1]!.score}
                  </div>
                  <div>
                    <em>{variant}</em> {roundLine}
                  </div>
                </>
              )}
            </div>
          </header>
          <p className="spec-turn">
            {rummyLive ? rummyPhaseLine(rummyBoard) : phaseLine(board, family)}
          </p>
          {(rummyLive ? rummyBoard.lastMessage : board.lastMessage) ? (
            <p className="spec-msg">{rummyLive ? rummyBoard.lastMessage : board.lastMessage}</p>
          ) : null}
        </>
      ) : null}
      {!slCap || !linkOk ? <p className="spec-msg">Waiting for the table link…</p> : null}

      {rummyLive ? (
        <div className="spec-grid is-rummy">
          <div className="spec-north">
            <RummySeatChip board={rummyBoard} seat={2} label="opposite" />
          </div>
          <div className="spec-them" />
          <div className="spec-west">
            <RummySeatChip board={rummyBoard} seat={3} label="left" />
          </div>
          <div className="spec-mid">
            <div className="piles spec-piles">
              <div className="pile-slot" data-stock-pile>
                <span className="pile-label">Stock · {stockCount}</span>
                <CardView facedown size="lg" />
              </div>
              <div className="pile-slot discard" data-discard-pile>
                <span className="pile-label">Discard · {discardCount}</span>
                {topCard ? (
                  <CardView card={topCard} size="lg" />
                ) : (
                  <div className="pile-empty">Empty</div>
                )}
                {topCard ? <span className="preview">{rankLabel(topCard.rank)}</span> : null}
              </div>
            </div>
          </div>
          <div className="spec-east">
            <RummySeatChip board={rummyBoard} seat={1} label="right" />
          </div>
          <div className="spec-us" />
          <div className="spec-south">
            <RummySeatChip board={rummyBoard} seat={0} label="this side" />
          </div>
        </div>
      ) : canastaLive ? (
        <div className="spec-grid">
          <div className="spec-north">
            <SeatChip board={board} seat={2} label="opposite" family={family} />
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
            <SeatChip board={board} seat={3} label="left" family={family} />
          </div>
          <div className="spec-mid">
            <div className="piles spec-piles">
              <div className="pile-slot" data-stock-pile>
                <span className="pile-label">Stock · {stockCount}</span>
                <CardView facedown size="lg" />
              </div>
              <div className={`pile-slot discard ${frozen ? 'is-frozen' : ''}`} data-discard-pile>
                <span className="pile-label">
                  Discard · {discardCount}
                  {frozen ? ' · frozen' : ''}
                </span>
                {topCard ? (
                  <div className={sideways ? 'side-wrap' : undefined}>
                    <CardView card={topCard} size="lg" sideways={sideways} />
                  </div>
                ) : (
                  <div className="pile-empty">Empty</div>
                )}
                {topCard ? <span className="preview">{rankLabel(topCard.rank)}</span> : null}
              </div>
            </div>
          </div>
          <div className="spec-east">
            <SeatChip board={board} seat={1} label="right" family={family} />
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
            <SeatChip board={board} seat={0} label="this side" family={family} />
          </div>
        </div>
      ) : (
        <div className="spec-parlor">
          {isRummy ? (
            <h2 className="spec-parlor-title">
              RUMMY
              <em>parlor</em>
            </h2>
          ) : (
            <h2 className="spec-parlor-title">
              HAND &amp; FOOT
              <em>/ CANASTA</em>
            </h2>
          )}
          <p>{isRummy ? 'Sit to play · free-for-all Rummy' : 'Sit to play · partners sit across'}</p>
        </div>
      )}
    </div>
  )
}
