# Skippo family — plan

Sister product to Canasta / Rummy / Trick / Ichi. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=skippo`).

Brand name **Skippo** (not a commercial trademark). Sequencing / builder piles.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** | Classic, Hand & Foot, Samba, Bolivia | Melds / pile / canastas |
| **rummy** | Standard, Gin, Oklahoma, Rummy 500, Kalooki | Sets + runs |
| **trick** | Hearts, Rooster, Spades, Euchre, Oh Hell | Follow suit, tricks |
| **ichi** | Classic, Eights, Twin Piles, Switch, Palace, Flip | Match color/number |
| **skippo** (this work) | Classic Skippo | Stock + builders 1–12 |

## Creator lock

- Skippo tables: `Skippo_Table.lsl` + `Skippo_Http.lsl` → status `family:"skippo"`.
- Table-top MoAP: `Skippo_Display.lsl` (`?family=skippo`).
- Same mesh / `Canasta HUD` inventory name; table status gates the web UI.
- Buyers cannot flip the family.

## Build order

1. LSL clones + `family` in JSONP — this pass.
2. Web reads `family=skippo` — this pass.
3. **Classic Skippo** solo + bots (2–4) — this pass.
4. Spectator BOARD (`K1~`) + Furware — this pass.
5. PeerJS multiplayer — this pass.

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | Stock 30; hand 5; 4 builders; 4 discards; to 500 |

See `RULES_SKIPPO.md`.

## Multiplayer notes

- Peer ids: `skippo-<room>-host`.
- Free-for-all; empty chairs in the chosen 2–4 seats are bots.
