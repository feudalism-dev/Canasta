# Warfront — implementation status

**Slug:** `warfront` · **Product:** Warfront  
**GDD:** [`Docs/Warfront_Game_Design_doc.md`](./Warfront_Game_Design_doc.md)

## Done

- GDD (modes, map, units, combat, economy, HUD camera, wire budget, bots, open questions)
- Family registration (`family.ts` + tests + aliases)
- Core land engine: map graph (28 zones), setup, income, buy/place, ranged, move, combat, win
- Sea theater flag + unit catalog (same map topology; ports instead of depots)
- Compact public board wire `W1~` + encode/decode + size tests
- Bot: spend PP, reinforce, attack weak adjacent, end turn
- Local solo session with bot timer
- HUD: pan / zoom / minimap / recenter, territory select, buy panel, end turn
- Table overview component (`WarfrontSpectator`)
- PeerSession + DisplaySync stubs wired like Battle Fleet (MP path exists)
- `App.tsx` / `SlTableScreens` / `SpectatorTable` / `ParkedHud` wiring
- Core rules + wire tests (vitest)

## Playable now

Browser solo vs bots (land recommended):

```bash
npm run dev
```

Open the app, pick **Warfront** (or `?play=warfront`), start solo vs bots. Loop: income → buy/place → optional ranged → move/combat → end turn → bots play → VP/elim win.

## Stubbed / TODO

- Sea mode: rules present; UI labels switch; deeper sea-specific AI / capture polish TBD
- 2v2: team VP + no ally attacks implemented; needs more playtest
- Peer multiplayer: session skeleton mirrors Battle Fleet — lobby/start/move path present; harden reconnect/grace
- DisplaySync: posts compact board when SL cap available; needs in-world soak test under 1600 chars with max stacks
- Final ad art (placeholder SVG); LSL box `GRANT_FAMILY = "warfront"`
- Advanced combat (retreat mid-fight, fog, tech) deferred per GDD
- Minimap viewport rect polish / keyboard accessibility polish

## How to run

```bash
npm install          # if needed
npm run dev          # Vite — open shown localhost URL
npm test             # includes warfront core/wire tests
npm run build        # typecheck + production build
```

Web tip: `?play=warfront` jumps into the Warfront setup/play path like Battle Fleet.
