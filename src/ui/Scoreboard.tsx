import { useEffect, useRef, useState } from 'react'
import {
  fetchScores,
  mergeGames,
  normalizeGames,
  refreshScores,
  type ScoreGame,
  type ScoreGames,
  type ScoreRow,
} from '../sl/scoresApi'
import {
  cacheAgeLabel,
  loadScoreboardCache,
  writeScoreboardCachePatch,
} from './scoreboardCache'
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

function gameLabel(tab: ScoreGame): string {
  if (tab === 'h') return 'Hand & Foot'
  if (tab === 's') return 'Samba'
  if (tab === 'b') return 'Bolivia'
  return 'Canasta'
}

function formatScore(n: number): string {
  return n.toLocaleString()
}

export function Scoreboard({ slCap }: Props) {
  const cached = loadScoreboardCache()
  const [game, setGame] = useState<ScoreGame>('c')
  const [scope, setScope] = useState<Scope>('local')
  const [period, setPeriod] = useState<Period>('w')
  const [local, setLocal] = useState<ScoreGames>(() => cached?.local ?? emptyGames())
  const [net, setNet] = useState<ScoreGames>(() => cached?.net ?? emptyGames())
  const [err, setErr] = useState('')
  const [month, setMonth] = useState(() => cached?.month ?? '')
  const [linked, setLinked] = useState(false)
  const [cachedAt, setCachedAt] = useState(() => cached?.savedAt ?? 0)
  const localRef = useRef(local)
  const netRef = useRef(net)
  const monthRef = useRef(month)
  const cachedAtRef = useRef(cachedAt)
  localRef.current = local
  netRef.current = net
  monthRef.current = month
  cachedAtRef.current = cachedAt

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
    let failStreak = 0
    let timer: number | undefined
    const pull = async (refreshNet: boolean) => {
      try {
        const data = refreshNet ? await refreshScores(slCap, game) : await fetchScores(slCap, game)
        if (!alive) return
        if (!data.ok) {
          setLinked(false)
          failStreak += 1
          const at = cachedAtRef.current
          setErr(
            at > 0
              ? `Offline — showing scores from ${cacheAgeLabel(at)}.`
              : data.error || 'Scoreboard error',
          )
          return
        }
        failStreak = 0
        const nextLocal = data.local ? mergeGames(localRef.current, data.local) : localRef.current
        const nextNet = data.net ? mergeGames(netRef.current, data.net) : netRef.current
        const nextMonth = data.month || monthRef.current
        const snap = writeScoreboardCachePatch(
          localRef.current,
          netRef.current,
          monthRef.current,
          data.local,
          data.net,
          data.month,
        )
        setLocal(nextLocal)
        setNet(nextNet)
        if (data.month) setMonth(nextMonth)
        setCachedAt(snap.savedAt)
        setErr('')
        setLinked(true)
      } catch {
        if (!alive) return
        setLinked(false)
        failStreak += 1
        const at = cachedAtRef.current
        setErr(
          at > 0
            ? `Offline — showing scores from ${cacheAgeLabel(at)}. Reconnecting…`
            : 'Cannot reach scoreboard — reset the core script or gear → Refresh.',
        )
      } finally {
        if (!alive) return
        const delay = failStreak === 0 ? 8000 : Math.min(45000, 8000 + failStreak * 6000)
        timer = window.setTimeout(() => void pull(false), delay)
      }
    }
    void pull(true)
    return () => {
      alive = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [slCap, game])

  const rows: ScoreRow[] = (scope === 'local' ? local : net)[game][period] || []
  const scopeLabel = scope === 'local' ? 'This parlor' : 'Network'
  const sub =
    period === 'm' && month
      ? month
      : period === 'w'
        ? 'This week'
        : 'All time'
  const showingCache = !linked && cachedAt > 0

  return (
    <div className="scoreboard-root">
      <div className="scoreboard-panel">
        <div className="table-felt" />
        <header className="scoreboard-head">
          <p className="brand-kicker">Canasta parlor</p>
          <h1>High scores</h1>
          <p className="scoreboard-sub">
            {gameLabel(game)} · {scopeLabel} · {periodLabel(period)} · {sub}
            {showingCache ? ` · cached ${cacheAgeLabel(cachedAt)}` : ''}
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
        {err ? <p className="scoreboard-err">{err}</p> : null}
        {showingCache && !linked ? (
          <p className="scoreboard-empty" role="status">
            Still retrying the in-world link. Owner: reset the core script, or gear → Refresh.
          </p>
        ) : null}
        {linked && rows.length === 0 ? (
          <p className="scoreboard-empty" role="status">
            {scope === 'local'
              ? 'No parlor scores yet — finish a match within ~100 m, or use the gear to set a score.'
              : 'No network scores yet — parcel must allow the Experience, and the core script must be compiled with it. Try Lifetime, or wait a few seconds for refresh.'}
          </p>
        ) : null}
        {!linked && !showingCache && rows.length === 0 ? (
          <p className="scoreboard-empty" role="status">
            No cached scores yet — connect once successfully to store a local snapshot.
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
      </div>
    </div>
  )
}
