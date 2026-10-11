# Yotsy family — plan

Sister product to Canasta / Rummy / Trick / Ichi / Skippo / Phase It. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=yotsy`).

Brand name **Yotsy** (Yahtzee-style dice parlor; not a commercial trademark). Animated rolling dice on the HUD.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** | Classic, Hand & Foot, Samba, Bolivia | Melds / pile / canastas |
| **rummy** | Standard, Gin, Oklahoma, Rummy 500, Kalooki | Sets + runs |
| **trick** | Hearts, Rooster, Spades, Euchre, Oh Hell | Follow suit, tricks |
| **ichi** | Classic, Eights, Twin Piles, Switch, Palace, Flip | Match color/number |
| **skippo** | Classic, Short, Partners, Jump-In | Stock + builders 1–12 |
| **phaseit** | Classic Phase It | 10 phases · sets / runs / color |
| **yotsy** (this work) | Classic Yotsy, Dismet (later) | Five dice · 13 boxes |

## Creator lock

- Yotsy tables: `Yotsy_Table.lsl` + `Yotsy_Http.lsl` → status `family:"yotsy"`.
- Table-top MoAP: `Yotsy_Display.lsl` (`?family=yotsy`).
- Same mesh / `Canasta HUD` inventory name; table status gates the web UI.

## Build order

1. LSL clones + `family` in JSONP — this pass.
2. Web reads `family=yotsy` — this pass.
3. **Classic Yotsy** solo + bots (1–4) — this pass.
4. Spectator BOARD (`Y1~`) + Furware — this pass.
5. PeerJS multiplayer — this pass.
6. **Dismet** (colored numbers) — later.

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | 5 dice, 3 rolls, 13 boxes, upper bonus 35, Yotsy bonuses +100 |
| `dismet` | stub | Colored-number variant — coming soon |

See `RULES_YOTSY.md`.

## Multiplayer notes

- Peer ids: `yotsy-<room>-host`.
- Free-for-all; empty chairs in the chosen 1–4 seats are bots.
