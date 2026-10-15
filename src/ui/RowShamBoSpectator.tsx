import { useState } from 'react'
import {
  kindGlyph,
  rowShamBoSpectatorStatus,
  rowShamBoVariantLabel,
  type RowShamBoPublicBoard,
  type RowShamBoPublicPlay,
} from '../core/rowshambo/publicBoard'
import type { RowShamBoKind } from '../core/rowshambo/types'
import { cardLabel } from '../core/rowshambo/deck'
import { directionLabel, rowShamBoBeatKey } from '../core/rowshambo/variants'
import '../styles/rowshambo.css'

type CompassPoint = 'n' | 'e' | 's' | 'w'

function assetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}assets/rowshambo/${file}`
}

/** Table-top view is always from seat 0 (this side = south). */
function compassFromSeat0(seat: number, playerCount: number): CompassPoint {
  if (playerCount <= 2) return seat === 0 ? 's' : 'n'
  const rel = (((seat % 4) + 4) % 4)
  return (['s', 'e', 'n', 'w'] as const)[rel] ?? 'n'
}

function CardBack() {
  return (
    <div className="rsb-card is-back has-art is-lg" aria-label="Face down">
      <img className="rsb-card-face" src={assetUrl('card-back.png')} alt="" />
    </div>
  )
}

function CardFace({ kind }: { kind: RowShamBoKind }) {
  const [imgOk, setImgOk] = useState(true)
  const src = assetUrl(`${kind}.png`)
  return (
    <div
      className={`rsb-card is-${kind}${imgOk ? ' has-art' : ''} is-lg`}
      aria-label={cardLabel({ id: kind, kind })}
    >
      {imgOk ? (
        <img className="rsb-card-face" src={src} alt="" onError={() => setImgOk(false)} />
      ) : (
        <>
          <span className="rsb-card-glyph" aria-hidden>
            {kindGlyph(kind)}
          </span>
          <span className="rsb-card-label">{cardLabel({ id: kind, kind })}</span>
        </>
      )}
    </div>
  )
}

function TableCard({ play }: { play: RowShamBoPublicPlay }) {
  if (play == null) return null
  if (play === 'down') return <CardBack />
  return <CardFace kind={play} />
}

function duelBadge(
  board: RowShamBoPublicBoard,
  seat: number,
): { kind: 'win' | 'lose' | 'tie' | 'idle'; label: string } {
  const d = board.duel
  if (!d || d.subphase !== 'result' || !d.outcome) return { kind: 'idle', label: '' }
  const inContested = d.contestedSeats.includes(seat)
  const isNext = d.nextSeat === seat
  if (!inContested && !isNext) return { kind: 'idle', label: '' }
  if (d.outcome === 'tie') return { kind: 'tie', label: 'TIE' }
  if (d.outcome === 'contestedWin') {
    return inContested ? { kind: 'win', label: 'WIN' } : { kind: 'lose', label: 'OUT' }
  }
  return isNext ? { kind: 'win', label: 'WIN' } : { kind: 'lose', label: 'OUT' }
}

/**
 * Parlor MoAP table-top view — same comic chrome as the HUD game,
 * without private hands.
 */
export function RowShamBoSpectator({ board }: { board: RowShamBoPublicBoard }) {
  const status = rowShamBoSpectatorStatus(board)
  const prompt = board.lastMessage || status
  const fighting = board.phase === 'resolve' || board.phase === 'reveal'
  const sorted = [...board.players].sort((a, b) => a.seat - b.seat)
  const duel = board.duel
  const showBurst = fighting && duel?.subphase === 'result' && duel.outcome

  if (!board.live) {
    return (
      <div className="rsb-root is-spectator is-idle" aria-label="Row! Sham! Bo! parlor">
        <header className="rsb-head">
          <div>
            <h2 className="rsb-title">Row! Sham! Bo!</h2>
            <p className="rsb-sub">Table top · sit to play</p>
          </div>
        </header>
        <div className="rsb-stage">
          <div className="rsb-arena" aria-label="Arena">
            <div className="rsb-dial">
              <div className="rsb-dial-core">
                Sit to play
                <br />
                RPS · Pass · Duel
              </div>
            </div>
            <div className="rsb-prompt">Directional Rock-Paper-Scissors</div>
          </div>
        </div>
      </div>
    )
  }

  const beatKey = rowShamBoBeatKey(board.variant)
  const burst =
    showBurst && duel
      ? duel.outcome === 'tie'
        ? { text: 'TIE!', cls: 'is-tie', img: 'burst-tie.png' }
        : duel.outcome === 'contestedWin'
          ? { text: 'OOF!', cls: 'is-oof', img: 'burst-oof.png' }
          : { text: 'POW!', cls: '', img: 'burst-pow.png' }
      : null

  return (
    <div
      className={`rsb-root is-spectator${board.variant === 'elements' ? ' is-elements' : ''}`}
      aria-label="Row! Sham! Bo! table top"
    >
      <header className="rsb-head">
        <div>
          <h2 className="rsb-title">Row! Sham! Bo!</h2>
          <p className="rsb-sub">
            {rowShamBoVariantLabel(board.variant)} · to {board.playTo} · Round{' '}
            {Math.max(1, board.handNumber)} · Game {board.gameNumber}
            {board.direction ? ` · ${directionLabel(board.direction)}` : ''}
          </p>
        </div>
        <span className="rsb-spec-badge">Table top</span>
      </header>

      <div className="rsb-stage">
        <aside className="rsb-beat-key" aria-label="What beats what">
          <div className="rsb-beat-key-head">Beat key</div>
          <ul className="rsb-beat-key-list">
            {beatKey.map((row) => (
              <li key={row.kind} className={`rsb-beat-row is-${row.kind.toLowerCase()}`}>
                <strong>{row.kind}</strong>
                <span>beats {row.beats}</span>
              </li>
            ))}
          </ul>
        </aside>
        <div className="rsb-arena" aria-label="Arena">
          {fighting ? (
            <div
              className={`rsb-duel-table${
                board.direction === 'cw' ? ' is-cw' : board.direction === 'ccw' ? ' is-ccw' : ''
              }`}
              aria-label="Table plays"
            >
              {sorted.map((p) => {
                const compass = compassFromSeat0(p.seat, board.playerCount)
                const isButton = board.buttonSeat === p.seat
                const play = board.tablePlays[p.seat] ?? null
                const inContested = Boolean(duel?.contestedSeats.includes(p.seat))
                const isChallenger = Boolean(duel && duel.nextSeat === p.seat)
                const inDuel = inContested || isChallenger
                const result = duelBadge(board, p.seat)
                return (
                  <div
                    key={p.seat}
                    className={`rsb-duel-slot is-${compass}${inDuel ? ' is-dueling' : ' is-sideline'}${
                      isButton ? ' is-button' : ''
                    }${result.kind !== 'idle' ? ` is-${result.kind}` : ''}`}
                  >
                    <span className="rsb-duel-name">
                      {isButton ? '★ ' : ''}
                      {p.name}
                    </span>
                    <div className="rsb-duel-card-wrap">
                      {play != null ? <TableCard play={play} /> : <CardBack />}
                      {result.kind !== 'idle' ? (
                        <span className={`rsb-duel-badge is-${result.kind}`}>{result.label}</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              <div className="rsb-duel-center" aria-hidden>
                {burst ? (
                  <div className="rsb-burst is-center">
                    <img
                      className={`rsb-burst-img ${burst.cls}`}
                      src={assetUrl(burst.img)}
                      alt={burst.text}
                      onError={(e) => {
                        const el = e.currentTarget
                        el.style.display = 'none'
                        const fallback = el.nextElementSibling as HTMLElement | null
                        if (fallback) fallback.hidden = false
                      }}
                    />
                    <div className={`rsb-burst-stamp ${burst.cls}`} hidden>
                      {burst.text}
                    </div>
                  </div>
                ) : (
                  <div className="rsb-duel-hub">
                    <span className="rsb-duel-hub-dir">
                      {board.direction ? directionLabel(board.direction) : 'Fight!'}
                    </span>
                    <span className="rsb-duel-hub-step">
                      {duel && duel.stepIndex >= 0
                        ? `Duel ${duel.stepIndex + 1}`
                        : 'Cards down…'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`rsb-dial${board.phase === 'chooseDir' ? ' is-spin' : ''}${
                board.direction === 'cw' ? ' is-cw' : board.direction === 'ccw' ? ' is-ccw' : ''
              }`}
            >
              <div className="rsb-dial-core">
                {board.direction ? directionLabel(board.direction) : '???'}
                <br />
                Stock {board.stockCount}
              </div>
            </div>
          )}
          <div className="rsb-prompt">{prompt}</div>
        </div>

        <aside className="rsb-scoreboard" aria-label="Scoreboard">
          <div className="rsb-scoreboard-head">
            <span>Scoreboard</span>
            <em>to {board.playTo}</em>
          </div>
          <div className="rsb-scoreboard-cols" aria-hidden>
            <span />
            <span>Game</span>
            <span>Match</span>
          </div>
          <ol className="rsb-scoreboard-list">
            {sorted.map((p) => (
              <li
                key={p.seat}
                className={`rsb-score-row${board.buttonSeat === p.seat ? ' is-button' : ''}${
                  board.phase === 'matchEnd' &&
                  p.matchScore === Math.max(...sorted.map((x) => x.matchScore))
                    ? ' is-winner'
                    : ''
                }`}
              >
                <span className="rsb-score-name">
                  {board.buttonSeat === p.seat ? '★ ' : ''}
                  {p.name}
                </span>
                <span className="rsb-score-game">{p.gameScore}</span>
                <span className="rsb-score-match">{p.matchScore}</span>
              </li>
            ))}
          </ol>
          <p className="rsb-spec-status">{status}</p>
        </aside>
      </div>
    </div>
  )
}
