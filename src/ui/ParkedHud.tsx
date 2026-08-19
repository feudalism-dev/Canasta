import type { SlBootstrap } from '../sl/bootstrap'
import { buildSessionUrl } from '../sl/sessionUrl'

export function ParkedHud({ boot }: { boot: SlBootstrap }) {
  return (
    <div className="shell-menu parked-shell">
      <div className="menu-card">
        <p className="brand-kicker">Second Life table</p>
        <h1>HUD parked</h1>
        <p>
          You are playing a solo Hand &amp; Foot / Canasta game in your web browser. This HUD is on
          standby so you do not also play from the table.
        </p>
        <p className="muted">Seat {boot.seat >= 0 ? boot.seat + 1 : '?'} stays yours while you remain seated.</p>
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
