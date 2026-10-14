# Phase It family — plan

Sister product to Canasta / Rummy / Trick / Ichi / Skippo. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=phaseit`).

Brand name **Phase It** (Phase 10–style phase race; not a commercial trademark).

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** | Classic, Hand & Foot, Samba, Bolivia | Melds / pile / canastas |
| **rummy** | Standard, Gin, Oklahoma, Rummy 500, Kalooki | Sets + runs |
| **trick** | Hearts, Rooster, Spades, Euchre, Oh Hell | Follow suit, tricks |
| **ichi** | Classic, Eights, Twin Piles, Switch, Palace, Flip | Match color/number |
| **skippo** | Classic, Short, Partners, Jump-In | Stock + builders 1–12 |
| **phaseit** (this work) | Classic / Masters / Sprint | phases · sets / runs / color |

## Creator lock

- Phase It tables: `PhaseIt_Table.lsl` + `PhaseIt_Http.lsl` → status `family:"phaseit"`.
- Table-top MoAP: `PhaseIt_Display.lsl` (`?family=phaseit`).
- Same mesh / `Canasta HUD` inventory name; table status gates the web UI.
- Buyers cannot flip the family.

## Build order

1. LSL clones + `family` in JSONP — this pass.
2. Web reads `family=phaseit` — this pass.
3. **Classic Phase It** solo + bots (2–4) — this pass.
4. Spectator BOARD (`P1~`) + Furware — this pass.
5. PeerJS multiplayer — this pass.

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | 108-card deck; hand 10; phases 1→10 in order; leftover points; first through Phase 10 wins |
| `masters` | ready | Same 10 phases; choose any remaining phase each hand before drawing |
| `sprint` | ready | Phases 1→5 only; same turn structure; faster match |

See `RULES_PHASEIT.md`.

## Multiplayer notes

- Peer ids: `phaseit-<room>-host`.
- Free-for-all; empty chairs in the chosen 2–4 seats are bots.
