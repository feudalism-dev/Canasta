import type { SlBootstrap } from '../sl/bootstrap'
import { buildSessionUrl } from '../sl/sessionUrl'

export function ParkedHud({ boot }: { boot: SlBootstrap }) {
  const matchParked = Boolean(boot.room)
  return (
    <div className="shell-menu parked-shell">
      <div className="menu-card">
        <p className="brand-kicker">Second Life table</p>
        <h1>HUD parked</h1>
        {matchParked ? (
          <p>
            You are playing this multiplayer match in your web browser. Stay seated. The host keeps
            the game on their HUD. This HUD is on standby so you do not run two clients.
          </p>
        ) : (
          <p>
            You are playing a solo Hand &amp; Foot / Canasta game in your web browser. This HUD is on
            standby so you do not also play from the table.
          </p>
        )}
        <p>
          Second Life often cannot force a browser to open. We already copied the play URL to your
          clipboard. If a browser did not open: open Chrome or Firefox yourself, click the address
          bar, and paste (<kbd>Ctrl+V</kbd>), then Enter.
        </p>
        <p className="muted">
          Seat {boot.seat >= 0 ? boot.seat + 1 : '?'} stays yours while you remain seated
          {boot.room ? ` · room ${boot.room}` : ''}.
        </p>
        <button
          type="button"
          className="btn secondary"
          onClick={() => window.location.assign(buildSessionUrl(boot, { client: 'hud', action: 'hud' }))}
        >
          Return to HUD
        </button>
      </div>
    </div>
  )
}
