import { useEffect, useState } from 'react'
import {
  fetchScores,
  normalizeGames,
  refreshScores,
  type ScoreGame,
  type ScoreGames,
  type ScoreRow,
} from '../sl/scoresApi'
import { applyUiScale } from './uiScale'

type Scope = 'local' | 'net'
type Period = 'w' | 'm' | 'l'
type ScoreTab = ScoreGame | 's' | 'b'

type Props = {
  slCap: string
}

function emptyGames(): ScoreGames {
  return normalizeGames(null)
}

function periodLabel(period: Period): string {
  if (period === 'w') return 'Weekly'
  if (period === 'm') return 'Monthly'
  return 'Lifetime'
}

function gameLabel(tab: ScoreTab): string {
  if (tab === 'h') return 'Hand & Foot'
  if (tab === 's') return 'Samba'
  if (tab === 'b') return 'Bolivia'
  return 'Canasta'
}

function isComingSoon(tab: ScoreTab): boolean {
  return tab === 's' || tab === 'b'
}

function formatScore(n: number): string {
  return n.toLocaleString()
}

export function Scoreboard({ slCap }: Props) {
  const [game, setGame] = useState<ScoreTab>('c')
  const [scope, setScope] = useState<Scope>('local')
  const [period, setPeriod] = useState<Period>('w')
  const [local, setLocal] = useState<ScoreGames>(emptyGames)
  const [net, setNet] = useState<ScoreGames>(emptyGames)
  const [err, setErr] = useState('')
  const [month, setMonth] = useState('')
  const [linked, setLinked] = useState(false)

  useEffect(() => {
    applyUiScale(1)
  }, [])

  useEffect(() => {
    if (!slCap) {
      setErr('Waiting for the scoreboard link… Reset the scoreboard scripts if this stays blank.')
      setLinked(false)
      return
    }
    let alive = true
    const pull = async (refreshNet: boolean) => {
      try {
        const data = refreshNet ? await refreshScores(slCap) : await fetchScores(slCap)
        if (!alive) return
        if (!data.ok) {
          setErr(data.error || 'Scoreboard error')
          setLinked(false)
          return
        }
        setErr('')
        setLinked(true)
        if (data.local) setLocal(normalizeGames(data.local))
        if (data.net) setNet(normalizeGames(data.net))
        if (data.month) setMonth(data.month)
      } catch (e) {
        if (alive) {
          setLinked(false)
          setErr(e instanceof Error ? e.message : 'Cannot reach scoreboard')
        }
      }
    }
    void pull(true)
    const id = window.setInterval(() => void pull(false), 4000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [slCap])

  const liveGame: ScoreGame | null = game === 'c' || game === 'h' ? game : null
  const rows: ScoreRow[] = liveGame ? (scope === 'local' ? local : net)[liveGame][period] || [] : []
  const scopeLabel = scope === 'local' ? 'This parlor' : 'Network'
  const sub =
    period === 'm' && month
      ? month
      : period === 'w'
        ? 'This week'
        : 'All time'

  return (
    <div className="scoreboard-root">
      <div className="scoreboard-panel">
        <div className="table-felt" />
        <header className="scoreboard-head">
          <p className="brand-kicker">Canasta parlor</p>
          <h1>High scores</h1>
          <p className="scoreboard-sub">
            {gameLabel(game)} · {scopeLabel} · {periodLabel(period)} · {sub}
          </p>
        </header>
        <div className="scoreboard-tabs scoreboard-tabs-games" role="tablist" aria-label="Game">
          <button type="button" className={game === 'c' ? 'is-on' : ''} onClick={() => setGame('c')}>
            Canasta
          </button>
          <button type="button" className={game === 'h' ? 'is-on' : ''} onClick={() => setGame('h')}>
            Hand &amp; Foot
          </button>
          <button type="button" className={game === 's' ? 'is-on' : ''} onClick={() => setGame('s')}>
            Samba
          </button>
          <button type="button" className={game === 'b' ? 'is-on' : ''} onClick={() => setGame('b')}>
            Bolivia
          </button>
        </div>
        <div className="scoreboard-tabs" role="tablist" aria-label="Scoreboard range">
          <button type="button" className={scope === 'local' ? 'is-on' : ''} onClick={() => setScope('local')}>
            This parlor
          </button>
          <button type="button" className={scope === 'net' ? 'is-on' : ''} onClick={() => setScope('net')}>
            Network
          </button>
        </div>
        <div className="scoreboard-tabs" role="tablist" aria-label="Scoreboard period">
          <button type="button" className={period === 'w' ? 'is-on' : ''} onClick={() => setPeriod('w')}>
            Weekly
          </button>
          <button type="button" className={period === 'm' ? 'is-on' : ''} onClick={() => setPeriod('m')}>
            Monthly
          </button>
          <button type="button" className={period === 'l' ? 'is-on' : ''} onClick={() => setPeriod('l')}>
            Lifetime
          </button>
        </div>
        {err && !isComingSoon(game) ? <p className="scoreboard-err">{err}</p> : null}
        {isComingSoon(game) ? (
          <p className="scoreboard-soon" role="status">
            Coming soon — {gameLabel(game)} is in beta. High scores will be recorded when the variant leaves beta, on its own board.
          </p>
        ) : (
          <>
            {linked && rows.length === 0 ? (
              <p className="scoreboard-empty" role="status">
                {scope === 'local'
                  ? 'No parlor scores yet — finish a Canasta or Hand & Foot match within ~100 m, or use the gear to set a score.'
                  : 'No network scores yet — parcel must allow the Experience, and the core script must be compiled with it. Try Lifetime, or wait a few seconds for refresh.'}
              </p>
            ) : null}
            <ol className="scoreboard-list">
              {Array.from({ length: 10 }, (_, i) => {
                const row = rows[i]
                return (
                  <li key={i} className={row ? '' : 'is-empty'}>
                    <span className="scoreboard-rank">{i + 1}</span>
                    <span className="scoreboard-name">{row ? row.n : '—'}</span>
                    <span className="scoreboard-pts">{row ? formatScore(row.s) : ''}</span>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
