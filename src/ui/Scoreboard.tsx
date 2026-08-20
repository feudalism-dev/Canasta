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

function gameLabel(game: ScoreGame): string {
  return game === 'h' ? 'Hand & Foot' : 'Canasta'
}

function formatScore(n: number): string {
  return n.toLocaleString()
}

export function Scoreboard({ slCap }: Props) {
  const [game, setGame] = useState<ScoreGame>('c')
  const [scope, setScope] = useState<Scope>('local')
  const [period, setPeriod] = useState<Period>('w')
  const [local, setLocal] = useState<ScoreGames>(emptyGames)
  const [net, setNet] = useState<ScoreGames>(emptyGames)
  const [err, setErr] = useState('')
  const [month, setMonth] = useState('')

  useEffect(() => {
    applyUiScale(1)
  }, [])

  useEffect(() => {
    if (!slCap) return
    let alive = true
    const pull = async (refreshNet: boolean) => {
      try {
        const data = refreshNet ? await refreshScores(slCap) : await fetchScores(slCap)
        if (!alive) return
        if (!data.ok) {
          setErr(data.error || 'Scoreboard error')
          return
        }
        setErr('')
        if (data.local) setLocal(normalizeGames(data.local))
        if (data.net) setNet(normalizeGames(data.net))
        if (data.month) setMonth(data.month)
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : 'Cannot reach scoreboard')
      }
    }
    void pull(true)
    const id = window.setInterval(() => void pull(false), 4000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [slCap])

  const rows: ScoreRow[] = (scope === 'local' ? local : net)[game][period] || []
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
        <div className="table-brass" />
        <header className="scoreboard-head">
          <p className="brand-kicker">Hand &amp; Foot / Canasta</p>
          <h1>High scores</h1>
          <p className="scoreboard-sub">
            {gameLabel(game)} · {scopeLabel} · {periodLabel(period)} · {sub}
          </p>
        </header>
        <div className="scoreboard-tabs" role="tablist" aria-label="Game">
          <button type="button" className={game === 'c' ? 'is-on' : ''} onClick={() => setGame('c')}>
            Canasta
          </button>
          <button type="button" className={game === 'h' ? 'is-on' : ''} onClick={() => setGame('h')}>
            Hand &amp; Foot
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
        {err ? <p className="scoreboard-err">{err}</p> : null}
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
      </div>
    </div>
  )
}
