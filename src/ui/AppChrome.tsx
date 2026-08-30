import { useEffect, useState } from 'react'
import type { SlBootstrap } from '../sl/bootstrap'
import { openSeatedBrowser } from '../sl/sessionUrl'
import { HowToPlayOverlay } from './HowToPlay'
import { applyUiScale, clampUiScale, defaultUiScale, UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_STEP } from './uiScale'
import { preloadSfx, unlockSfx } from './sfx'
import { readSfxEnabled, writeSfxEnabled } from './sfxPref'

type Props = {
  slBoot: SlBootstrap | null
  parked?: boolean
  roomCode?: string
  onStatus?: (msg: string) => void
  showOppBooks?: boolean
  onShowOppBooks?: (on: boolean) => void
  showOurBooks?: boolean
  onShowOurBooks?: (on: boolean) => void
  /** Solo coach tips — only while a local match is active. */
  coachTips?: boolean
  onCoachTips?: (on: boolean) => void
  /** Leave match / return to menu — only while playing. */
  onMenu?: () => void
}

export function AppChrome({
  slBoot,
  parked,
  roomCode,
  onStatus,
  showOppBooks = true,
  onShowOppBooks,
  showOurBooks = true,
  onShowOurBooks,
  coachTips,
  onCoachTips,
  onMenu,
}: Props) {
  const [scale, setScale] = useState(() => defaultUiScale())
  const [helpOpen, setHelpOpen] = useState(false)
  const [sfxOn, setSfxOn] = useState(() => readSfxEnabled())
  // Baked at build from public/asset-rev.txt — not the MoAP ?rev= URL (often stale).
  const buildRev = typeof __CANASTA_ASSET_REV__ === 'string' ? __CANASTA_ASSET_REV__ : ''
  const urlRev = (slBoot?.rev || '').trim()
  const seated = Boolean(slBoot && slBoot.slCap && !parked)
  const alreadyBrowser = slBoot?.client === 'browser'

  useEffect(() => {
    applyUiScale(scale)
  }, [scale])

  useEffect(() => {
    preloadSfx()
    const unlock = () => unlockSfx()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return (
    <>
      <div className="app-chrome" role="toolbar" aria-label="Display controls">
        <div className="scale-control">
          <span className="scale-label">UI size</span>
          <button type="button" className="scale-btn" onClick={() => setScale((s) => clampUiScale(s - UI_SCALE_STEP))}>
            −
          </button>
          <input
            className="scale-slider"
            type="range"
            min={UI_SCALE_MIN}
            max={UI_SCALE_MAX}
            step={UI_SCALE_STEP}
            value={scale}
            onChange={(e) => setScale(clampUiScale(Number(e.target.value)))}
            aria-label="UI scale"
          />
          <button type="button" className="scale-btn" onClick={() => setScale((s) => clampUiScale(s + UI_SCALE_STEP))}>
            +
          </button>
          <span className="scale-pct">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className={`scale-btn tray-toggle ${sfxOn ? 'is-on' : ''}`}
            onClick={() => {
              const next = !sfxOn
              setSfxOn(next)
              writeSfxEnabled(next)
              if (next) unlockSfx()
            }}
            aria-pressed={sfxOn}
            title={sfxOn ? 'Mute card sounds' : 'Unmute card sounds'}
          >
            {sfxOn ? 'Sound on' : 'Sound off'}
          </button>
          {onShowOppBooks ? (
            <button
              type="button"
              className={`scale-btn tray-toggle ${showOppBooks ? 'is-on' : ''}`}
              onClick={() => onShowOppBooks(!showOppBooks)}
              aria-pressed={showOppBooks}
              title={
                showOppBooks
                  ? 'Hide their books on this HUD — still visible on the table top'
                  : 'Show their books on this HUD'
              }
            >
              {showOppBooks ? 'Hide their books' : 'Show their books'}
            </button>
          ) : null}
          {onShowOurBooks ? (
            <button
              type="button"
              className={`scale-btn tray-toggle ${showOurBooks ? 'is-on' : ''}`}
              onClick={() => onShowOurBooks(!showOurBooks)}
              aria-pressed={showOurBooks}
              title={
                showOurBooks
                  ? 'Hide our books on this HUD — still visible on the table top; use Meld to add'
                  : 'Show our books on this HUD'
              }
            >
              {showOurBooks ? 'Hide our books' : 'Show our books'}
            </button>
          ) : null}
          {onCoachTips ? (
            <button
              type="button"
              className={`scale-btn tray-toggle ${coachTips ? 'is-on' : ''}`}
              onClick={() => onCoachTips(!coachTips)}
              aria-pressed={Boolean(coachTips)}
              title={coachTips ? 'Turn off coach tips under the status bar' : 'Turn on coach tips under the status bar'}
            >
              {coachTips ? 'Coach on' : 'Coach off'}
            </button>
          ) : null}
        </div>
        <div className="chrome-actions">
          {onMenu ? (
            <button type="button" className="chrome-help-btn" onClick={onMenu} title="Leave match and return to the menu">
              Menu
            </button>
          ) : null}
          <button type="button" className="chrome-help-btn" onClick={() => setHelpOpen(true)}>
            Help
          </button>
          {seated && !alreadyBrowser && (
            <button
              type="button"
              className="chrome-browser-btn"
              onClick={() => {
                void openSeatedBrowser(slBoot!, roomCode).then((how) => {
                  onStatus?.(
                    how === 'opened'
                      ? 'Opened a solo game in your browser. Use “Play match in browser” in the lobby for multiplayer.'
                      : 'Copied the solo web link. Confirm the Second Life dialog to open your browser.',
                  )
                })
              }}
            >
              Solo in Browser
            </button>
          )}
          {alreadyBrowser && slBoot ? (
            <span className="chrome-note">Browser table · seat {(slBoot.seat >= 0 ? slBoot.seat : 0) + 1}</span>
          ) : null}
          {buildRev ? (
            <span
              className="chrome-rev"
              title={
                urlRev && urlRev !== buildRev
                  ? `Build r${buildRev} (MoAP URL still says rev=${urlRev})`
                  : `Build revision r${buildRev}`
              }
            >
              r{buildRev}
            </span>
          ) : null}
        </div>
      </div>
      <HowToPlayOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
