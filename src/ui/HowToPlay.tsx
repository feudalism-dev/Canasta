import { useState, type ReactNode } from 'react'

type Page = { kicker: string; title: string; body: ReactNode }

const PAGES: Page[] = [
  {
    kicker: '1 / 6',
    title: 'Two games, one table',
    body: (
      <>
        <p>
          Pick <strong>Classic Canasta</strong> (play to 5,000) or <strong>Hand and Foot</strong> (four
          rounds). Partnerships sit across the table — seats 1 &amp; 3 versus 2 &amp; 4.
        </p>
        <p>Melds are sets of the same rank, never runs. Seven of a rank is a canasta (or a book).</p>
      </>
    ),
  },
  {
    kicker: '2 / 6',
    title: 'Your turn',
    body: (
      <>
        <p>Draw from the stock, or take the whole discard pile when the HUD says you can. Then meld if you like, then discard.</p>
        <ul>
          <li>Canasta draws <strong>one</strong>. Hand and Foot draws <strong>two</strong>.</li>
          <li>A frozen pile (or any Hand and Foot pile) needs <strong>two natural cards</strong> of the top rank.</li>
          <li>
            An unfrozen Canasta pile can also be taken by adding the top card to a meld you already have of that
            rank — you do not need another matching card in hand.
          </li>
          <li>
            Those cards plus the top discard must also meet the <strong>initial meld</strong> (usually 50).
            Clicking the pile lays extra sets from your hand if needed.
          </li>
          <li>Red threes fly to the bonus tray automatically.</li>
        </ul>
      </>
    ),
  },
  {
    kicker: '3 / 6',
    title: 'The hand is sorted for you',
    body: (
      <>
        <p>Cards group by rank, the way people sort a physical hand. Tap a group to select it. The meld builder only offers legal plays, and the meter shows whether you have met the initial meld.</p>
      </>
    ),
  },
  {
    kicker: '4 / 6',
    title: 'Canastas and books',
    body: (
      <>
        <p>
          <strong>Clean / red</strong> = seven naturals, no wilds (+500). <strong>Dirty / black</strong> =
          mixed with wilds (+300). Hand and Foot books close at seven. Classic Canasta canastas may grow.
        </p>
      </>
    ),
  },
  {
    kicker: '5 / 6',
    title: 'Hand and Foot',
    body: (
      <>
        <p>Play your 13-card Hand first. When it is empty, pick up the Foot. To go out you need your Foot, the required books (default one clean and one dirty), a last discard, and your partner&apos;s OK.</p>
      </>
    ),
  },
  {
    kicker: '6 / 6',
    title: 'Second Life',
    body: (
      <>
        <p>Solo vs computer works in any browser. Multiplayer requires everyone seated at the same in-world table. Sit, become Active, then Create or Join.</p>
      </>
    ),
  },
]

export function HowToPlay({ onClose, closeLabel = 'Close' }: { onClose: () => void; closeLabel?: string }) {
  const [i, setI] = useState(0)
  const page = PAGES[i]!
  return (
    <div className="howto">
      <p className="brand-kicker">{page.kicker}</p>
      <h2>{page.title}</h2>
      {page.body}
      <div className="howto-nav">
        <button type="button" className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
          Back
        </button>
        {i < PAGES.length - 1 ? (
          <button type="button" className="btn primary" onClick={() => setI(i + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={onClose}>
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export function HowToPlayOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="banner-overlay" onClick={onClose}>
      <div className="banner-card wide help-card" onClick={(e) => e.stopPropagation()}>
        <HowToPlay onClose={onClose} />
      </div>
    </div>
  )
}
