import { useEffect, useState } from 'react'
import type { SlBootstrap } from '../sl/bootstrap'
import { openSeatedBrowser } from '../sl/sessionUrl'
import { HowToPlayOverlay } from './HowToPlay'
import { applyUiScale, clampUiScale, defaultUiScale, UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_STEP } from './uiScale'

type Props = {
  slBoot: SlBootstrap | null
  parked?: boolean
  roomCode?: string
  onStatus?: (msg: string) => void
  showOppTray?: boolean
  onShowOppTray?: (on: boolean) => void
}

export function AppChrome({ slBoot, parked, roomCode, onStatus, showOppTray = true, onShowOppTray }: Props) {
  const [scale, setScale] = useState(() => defaultUiScale())
  const [helpOpen, setHelpOpen] = useState(false)
  const seated = Boolean(slBoot && slBoot.slCap && !parked)
  const alreadyBrowser = slBoot?.client === 'browser'

  useEffect(() => {
    applyUiScale(scale)
  }, [scale])

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
          {onShowOppTray ? (
            <button
              type="button"
              className={`scale-btn tray-toggle ${showOppTray ? 'is-on' : ''}`}
              onClick={() => onShowOppTray(!showOppTray)}
              aria-pressed={showOppTray}
              title={
                showOppTray
                  ? 'Hide their books on this HUD — watch them on the table top'
                  : 'Show their books on this HUD'
              }
            >
              {showOppTray ? 'Hide tray' : 'Show tray'}
            </button>
          ) : null}
        </div>
        <div className="chrome-actions">
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
                      ? 'Opened in your browser. You can close this HUD media.'
                      : 'Copied the table link. Confirm the Second Life dialog to open your browser.',
                  )
                })
              }}
            >
              Play in Browser
            </button>
          )}
          {alreadyBrowser && slBoot ? (
            <span className="chrome-note">Browser table · seat {(slBoot.seat >= 0 ? slBoot.seat : 0) + 1}</span>
          ) : null}
        </div>
      </div>
      <HowToPlayOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
