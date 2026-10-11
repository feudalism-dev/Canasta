# Yotsy family — plan

Sister product to Canasta / Rummy / Trick / Ichi / Skippo / Phase It. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=yotsy`).

Brand name **Yotsy** (Yahtzee-style dice parlor; not a commercial trademark). Animated rolling dice on the HUD. **Kismet** is the colored-number sister variant.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** | Classic, Hand & Foot, Samba, Bolivia | Melds / pile / canastas |
| **rummy** | Standard, Gin, Oklahoma, Rummy 500, Kalooki | Sets + runs |
| **trick** | Hearts, Rooster, Spades, Euchre, Oh Hell | Follow suit, tricks |
| **ichi** | Classic, Eights, Twin Piles, Switch, Palace, Flip | Match color/number |
| **skippo** | Classic, Short, Partners, Jump-In | Stock + builders 1–12 |
| **phaseit** | Classic Phase It | 10 phases · sets / runs / color |
| **yotsy** (this work) | Classic Yotsy, Kismet | Five dice · 13 / 15 boxes |

## Creator lock

- Yotsy tables: `Yotsy_Table.lsl` + `Yotsy_Http.lsl` → status `family:"yotsy"`.
- Table-top MoAP: `Yotsy_Display.lsl` (`?family=yotsy`).
- Same mesh / `Canasta HUD` inventory name; table status gates the web UI.

## Build order

1. LSL clones + `family` in JSONP — done.
2. Web reads `family=yotsy` — done.
3. **Classic Yotsy** solo + bots (1–4) — done.
4. Spectator BOARD (`Y1~`) + Furware — done.
5. PeerJS multiplayer — done.
6. **Kismet** (colored numbers, flush, tiered bonus) — this pass.

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | 5 dice, 3 rolls, 13 boxes, upper bonus 35, Yotsy bonuses +100 |
| `kismet` | ready | Colored pips, 15 boxes, flush / same-color pairs, upper 35/55/75, Kismet bonuses +50 |

Legacy stub id `dismet` normalizes to `kismet`.

See `RULES_YOTSY.md`.

## Multiplayer notes

- Peer ids: `yotsy-<room>-host`.
- Free-for-all; empty chairs in the chosen 1–4 seats are bots.
- Spectator MoAP shows dice, seats, and totals for observers.
