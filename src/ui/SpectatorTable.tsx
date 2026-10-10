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
import {
  decodeTrickPublicBoard,
  idleTrickPublicBoard,
  isTrickBoardPayload,
  trickSpectatorStatus,
  trickVariantLabel,
  type TrickPublicBoard,
  type TrickPublicPlayer,
} from '../core/trick/publicBoard'
import {
  decodeIchiPublicBoard,
  idleIchiPublicBoard,
  ichiSpectatorStatus,
  ichiVariantLabel,
  isIchiBoardPayload,
  type IchiPublicBoard,
  type IchiPublicPlayer,
} from '../core/ichi/publicBoard'
import {
  decodeSkippoPublicBoard,
  idleSkippoPublicBoard,
  skippoSpectatorStatus,
  skippoVariantLabel,
  isSkippoBoardPayload,
  type SkippoPublicBoard,
  type SkippoPublicPlayer,
} from '../core/skippo/publicBoard'
import { colorLabel, kindLabel } from '../core/ichi/deck'
import { cardLabel } from '../core/skippo/deck'
import { passDirectionLabel } from '../core/trick/variants'
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

function trickPlayerAt(board: TrickPublicBoard, seat: number): TrickPublicPlayer | undefined {
  return board.players.find((p) => p.seat === seat)
}

function skippoPlayerAt(board: SkippoPublicBoard, seat: number): SkippoPublicPlayer | undefined {
  return board.players.find((p) => p.seat === seat)
}

function SkippoSeatChip({
  board,
  seat,
  label,
}: {
  board: SkippoPublicBoard
  seat: number
  label: string
}) {
  const p = skippoPlayerAt(board, seat)
  const isTurn = board.currentSeat === seat
  return (
    <div className={`spec-seat${isTurn ? ' is-turn' : ''}`}>
      <strong>{p?.name || `Seat ${seat + 1}`}</strong>
      <span className="muted tiny">{label}</span>
      {p ? (
        <span className="muted tiny">
          stock {p.stockCount}
          {p.stockTop ? ` · ${cardLabel(p.stockTop)}` : ''} · {p.score}
        </span>
      ) : null}
      {isTurn ? <span className="turn-pill">Turn</span> : null}
    </div>
  )
}

function ichiPlayerAt(board: IchiPublicBoard, seat: number): IchiPublicPlayer | undefined {
  return board.players.find((p) => p.seat === seat)
}

function IchiSeatChip({
  board,
  seat,
  label,
}: {
  board: IchiPublicBoard
  seat: number
  label: string
}) {
  const p = ichiPlayerAt(board, seat)
  const vacant = !p
  const isTurn = board.live && board.currentSeat === seat
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
          <span>
            {p.handCount} in hand · {p.score} pts
          </span>
          <em>Seat</em>
        </>
      )}
      {isTurn ? <span className="turn-pill">Turn</span> : null}
    </div>
  )
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

function TrickSeatChip({
  board,
  seat,
  label,
}: {
  board: TrickPublicBoard
  seat: number
  label: string
}) {
  const p = trickPlayerAt(board, seat)
  const vacant = !p
  const isTurn = board.live && board.currentSeat === seat
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
          <span>
            {p.handCount} in hand · {p.score} pts
          </span>
          <span className="muted tiny">
            {p.tricksTaken} trick{p.tricksTaken === 1 ? '' : 's'} · {p.takenThisHand} this hand
          </span>
          <em>Seat</em>
        </>
      )}
      {isTurn ? <span className="turn-pill">Turn</span> : null}
    </div>
  )
}

export function SpectatorTable({ slCap, familyHint = '' }: Props) {
  const [board, setBoard] = useState<PublicBoard>(idlePublicBoard)
  const [rummyBoard, setRummyBoard] = useState<RummyPublicBoard>(idleRummyPublicBoard)
  const [trickBoard, setTrickBoard] = useState<TrickPublicBoard>(idleTrickPublicBoard)
  const [ichiBoard, setIchiBoard] = useState<IchiPublicBoard>(idleIchiPublicBoard)
  const [skippoBoard, setSkippoBoard] = useState<SkippoPublicBoard>(idleSkippoPublicBoard)
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
      if (isSkippoBoardPayload(text)) {
        const next = decodeSkippoPublicBoard(text)
        setSkippoBoard(next)
        if (next.live) {
          setBoard(idlePublicBoard())
          setRummyBoard(idleRummyPublicBoard())
          setTrickBoard(idleTrickPublicBoard())
          setIchiBoard(idleIchiPublicBoard())
        }
        return true
      }
      if (isIchiBoardPayload(text)) {
        const next = decodeIchiPublicBoard(text)
        setIchiBoard(next)
        if (next.live) {
          setBoard(idlePublicBoard())
          setRummyBoard(idleRummyPublicBoard())
          setTrickBoard(idleTrickPublicBoard())
          setSkippoBoard(idleSkippoPublicBoard())
        }
        return true
      }
      if (isTrickBoardPayload(text)) {
        const next = decodeTrickPublicBoard(text)
        setTrickBoard(next)
        if (next.live) {
          setBoard(idlePublicBoard())
          setRummyBoard(idleRummyPublicBoard())
          setIchiBoard(idleIchiPublicBoard())
          setSkippoBoard(idleSkippoPublicBoard())
        }
        return true
      }
      if (isRummyBoardPayload(text)) {
        const next = decodeRummyPublicBoard(text)
        setRummyBoard(next)
        if (next.live) {
          setBoard(idlePublicBoard())
          setTrickBoard(idleTrickPublicBoard())
          setIchiBoard(idleIchiPublicBoard())
          setSkippoBoard(idleSkippoPublicBoard())
        }
        return true
      }
      const next = decodePublicBoard(text)
      if (next.live) {
        setBoard(next)
        setRummyBoard(idleRummyPublicBoard())
        setTrickBoard(idleTrickPublicBoard())
        setIchiBoard(idleIchiPublicBoard())
        setSkippoBoard(idleSkippoPublicBoard())
        return true
      }
      if (isIdleBoardPayload(text)) {
        setBoard(idlePublicBoard())
        setRummyBoard(idleRummyPublicBoard())
        setTrickBoard(idleTrickPublicBoard())
        setIchiBoard(idleIchiPublicBoard())
        setSkippoBoard(idleSkippoPublicBoard())
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
          setTrickBoard(idleTrickPublicBoard())
          setIchiBoard(idleIchiPublicBoard())
          setSkippoBoard(idleSkippoPublicBoard())
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
  const isTrick = family === 'trick'
  const isIchi = family === 'ichi'
  const isSkippo = family === 'skippo'
  const rummyLive = isRummy && rummyBoard.live
  const trickLive = isTrick && trickBoard.live
  const ichiLive = isIchi && ichiBoard.live
  const skippoLive = isSkippo && skippoBoard.live
  const canastaLive = !isRummy && !isTrick && !isIchi && !isSkippo && board.live
  const config = spectatorConfig(board)
  const variant = skippoLive
    ? skippoVariantLabel(skippoBoard.variant)
    : ichiLive
      ? ichiVariantLabel(ichiBoard.variant)
      : trickLive
        ? trickVariantLabel(trickBoard.variant)
        : isRummy
          ? rummyVariantLabel(rummyBoard.variant)
          : variantLabel(board.variant)
  const roundLine = skippoLive
    ? skippoBoard.playTo != null
      ? `H${skippoBoard.round} · to ${skippoBoard.playTo}`
      : `H${skippoBoard.round}`
    : ichiLive
      ? ichiBoard.playTo != null
        ? `H${ichiBoard.round} · to ${ichiBoard.playTo}`
        : `H${ichiBoard.round}`
      : trickLive
        ? trickBoard.playTo != null
          ? `H${trickBoard.round} · to ${trickBoard.playTo}`
          : `H${trickBoard.round}`
        : isRummy
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
  const frozen = !rummyLive && !trickLive && !ichiLive && !skippoLive && board.frozen
  const sideways = Boolean(topCard && (isWild(topCard) || frozen))
  const live = rummyLive || trickLive || ichiLive || skippoLive || canastaLive
  const trickPalette = trickBoard.variant === 'rooster' ? 'rooster' : 'french'
  const ichiColorCss: Record<string, string> = {
    R: '#c0392b',
    Y: '#d4a017',
    G: '#1e8449',
    B: '#2471a3',
  }

  return (
    <div className={`spectator-root ${live ? 'is-live' : ''}`} ref={rootRef}>
      <div className="table-felt" />
      <div className="table-brass" />
      {!isRummy && !isTrick && !isIchi && !isSkippo ? (
        <TableFlyLayer board={board} rootRef={rootRef} />
      ) : null}

      {live ? (
        <>
          <header className="spec-banner">
            <div className="brand-mark">
              {skippoLive ? (
                <>
                  <span>SKIPPO</span>
                  <small>TABLE TOP · PLAYER 1 VIEW</small>
                </>
              ) : ichiLive ? (
                <>
                  <span>ICHI</span>
                  <small>TABLE TOP · PLAYER 1 VIEW</small>
                </>
              ) : trickLive ? (
                <>
                  <span>{trickVariantLabel(trickBoard.variant).toUpperCase()}</span>
                  <small>TABLE TOP · PLAYER 1 VIEW</small>
                </>
              ) : isRummy ? (
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
              {skippoLive ? (
                <>
                  <div>
                    <em>{variant}</em> {roundLine}
                  </div>
                  <div>
                    <em>{skippoBoard.playerCount}p</em> · draw {skippoBoard.drawCount}
                  </div>
                </>
              ) : ichiLive ? (
                <>
                  <div>
                    <em>{variant}</em> {roundLine}
                  </div>
                  <div>
                    <em>{ichiBoard.playerCount}p</em> · color {ichiBoard.currentColor}
                    {ichiBoard.direction === 1 ? ' · CW' : ' · CCW'}
                  </div>
                </>
              ) : trickLive ? (
                <>
                  <div>
                    <em>{variant}</em> {roundLine}
                  </div>
                  <div>
                    <em>{trickBoard.playerCount}p</em>
                    {trickBoard.variant === 'hearts'
                      ? trickBoard.heartsBroken
                        ? ' · hearts broken'
                        : ' · hearts locked'
                      : trickBoard.variant === 'spades'
                        ? trickBoard.heartsBroken
                          ? ' · spades broken'
                          : ' · spades locked'
                        : trickBoard.variant === 'ohhell'
                          ? ' · exact bids'
                          : ' · partners'}
                  </div>
                  {trickBoard.phase === 'pass' ? (
                    <div>
                      <em>pass</em> {passDirectionLabel(trickBoard.passDirection)}
                    </div>
                  ) : null}
                </>
              ) : rummyLive ? (
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
            {skippoLive
              ? skippoSpectatorStatus(skippoBoard)
              : ichiLive
                ? ichiSpectatorStatus(ichiBoard)
                : trickLive
                  ? trickSpectatorStatus(trickBoard)
                  : rummyLive
                    ? rummyPhaseLine(rummyBoard)
                    : phaseLine(board, family)}
          </p>
          {(skippoLive
            ? skippoBoard.lastMessage
            : ichiLive
              ? ichiBoard.lastMessage
              : trickLive
                ? trickBoard.lastMessage
                : rummyLive
                  ? rummyBoard.lastMessage
                  : board.lastMessage) ? (
            <p className="spec-msg">
              {skippoLive
                ? skippoBoard.lastMessage
                : ichiLive
                  ? ichiBoard.lastMessage
                  : trickLive
                    ? trickBoard.lastMessage
                    : rummyLive
                      ? rummyBoard.lastMessage
                      : board.lastMessage}
            </p>
          ) : null}
        </>
      ) : null}
      {!slCap || !linkOk ? <p className="spec-msg">Waiting for the table link…</p> : null}

      {skippoLive ? (
        <div className="spec-grid is-trick">
          <div className="spec-north">
            <SkippoSeatChip board={skippoBoard} seat={2} label="opposite" />
          </div>
          <div className="spec-them" />
          <div className="spec-west">
            <SkippoSeatChip board={skippoBoard} seat={3} label="left" />
          </div>
          <div className="spec-mid">
            <div className="spec-trick-center" aria-label="Skippo builders">
              <span className="pile-label">Builders · draw {skippoBoard.drawCount}</span>
              <div className="rummy-card-row" style={{ justifyContent: 'center', gap: '0.35rem' }}>
                {skippoBoard.builders.map((top, i) => (
                  <div
                    key={i}
                    style={{
                      minWidth: '2.6rem',
                      height: '3.6rem',
                      borderRadius: '0.35rem',
                      background: top ? (top.rank == null ? '#3d2a4a' : '#2a5f6f') : '#1a242c',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                    }}
                  >
                    {top ? cardLabel(top) : skippoBoard.builderNext[i]}
                  </div>
                ))}
              </div>
              {skippoBoard.lastMessage ? (
                <span className="muted tiny">{skippoBoard.lastMessage}</span>
              ) : null}
            </div>
          </div>
          <div className="spec-east">
            <SkippoSeatChip board={skippoBoard} seat={1} label="right" />
          </div>
          <div className="spec-south">
            <SkippoSeatChip board={skippoBoard} seat={0} label="this side" />
          </div>
        </div>
      ) : null}

      {ichiLive ? (
        <div className="spec-grid is-trick">
          <div className="spec-north">
            <IchiSeatChip board={ichiBoard} seat={2} label="opposite" />
          </div>
          <div className="spec-them" />
          <div className="spec-west">
            <IchiSeatChip board={ichiBoard} seat={3} label="left" />
          </div>
          <div className="spec-mid">
            <div className="spec-trick-center" aria-label="Ichi discard">
              <span className="pile-label">
                Discard · {colorLabel(ichiBoard.currentColor)} · stock {ichiBoard.stockCount}
              </span>
              {ichiBoard.topDiscard ? (
                <div
                  style={{
                    minWidth: '3.5rem',
                    height: '4.8rem',
                    borderRadius: '0.4rem',
                    background: ichiBoard.topDiscard.color
                      ? ichiColorCss[ichiBoard.topDiscard.color]
                      : '#2c3e50',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {kindLabel(ichiBoard.topDiscard.kind)}
                </div>
              ) : (
                <span className="muted">No discard</span>
              )}
              {ichiBoard.lastMessage ? (
                <span className="muted tiny">{ichiBoard.lastMessage}</span>
              ) : null}
            </div>
          </div>
          <div className="spec-east">
            <IchiSeatChip board={ichiBoard} seat={1} label="right" />
          </div>
          <div className="spec-south">
            <IchiSeatChip board={ichiBoard} seat={0} label="this side" />
          </div>
        </div>
      ) : null}

      {trickLive ? (
        <div className="spec-grid is-trick">
          <div className="spec-north">
            <TrickSeatChip board={trickBoard} seat={2} label="opposite" />
          </div>
          <div className="spec-them" />
          <div className="spec-west">
            <TrickSeatChip board={trickBoard} seat={3} label="left" />
          </div>
          <div className="spec-mid">
            <div className="spec-trick-center" aria-label="Current trick">
              <span className="pile-label">
                {trickBoard.phase === 'pass'
                  ? `Pass ${passDirectionLabel(trickBoard.passDirection)}`
                  : trickBoard.phase === 'roundEnd' || trickBoard.phase === 'matchEnd'
                    ? 'Trick clear'
                    : `Trick · ${trickBoard.trick.length}/${trickBoard.playerCount}`}
              </span>
              {trickBoard.trick.length > 0 ? (
                <div className="spec-trick-cards">
                  {trickBoard.trick.map((t) => {
                    const who = trickPlayerAt(trickBoard, t.seat)
                    return (
                      <div key={`${t.seat}-${t.card.id}`} className="trick-play">
                        <CardView card={t.card} size="lg" palette={trickPalette} />
                        <span className="muted tiny">{who?.name ?? `P${t.seat + 1}`}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="pile-empty">
                  {trickBoard.phase === 'pass' ? 'Selecting cards…' : 'Waiting for lead'}
                </div>
              )}
              {trickBoard.lastTrickNote ? (
                <span className="muted tiny">{trickBoard.lastTrickNote}</span>
              ) : null}
            </div>
          </div>
          <div className="spec-east">
            <TrickSeatChip board={trickBoard} seat={1} label="right" />
          </div>
          <div className="spec-us" />
          <div className="spec-south">
            <TrickSeatChip board={trickBoard} seat={0} label="this side" />
          </div>
        </div>
      ) : rummyLive ? (
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
          {isSkippo ? (
            <h2 className="spec-parlor-title">
              SKIPPO
              <em>parlor</em>
            </h2>
          ) : isIchi ? (
            <h2 className="spec-parlor-title">
              ICHI
              <em>parlor</em>
            </h2>
          ) : isRummy ? (
            <h2 className="spec-parlor-title">
              RUMMY
              <em>parlor</em>
            </h2>
          ) : isTrick ? (
            <h2 className="spec-parlor-title">
              TRICK
              <em>parlor</em>
            </h2>
          ) : (
            <h2 className="spec-parlor-title">
              HAND &amp; FOOT
              <em>/ CANASTA</em>
            </h2>
          )}
          <p>
            {isSkippo
              ? 'Sit to play · Classic Skippo'
              : isIchi
                ? 'Sit to play · Classic Ichi'
                : isRummy
                  ? 'Sit to play · free-for-all Rummy'
                  : isTrick
                    ? 'Sit to play · Hearts, Rooster, Spades…'
                    : 'Sit to play · partners sit across'}
          </p>
        </div>
      )}
    </div>
  )
}
