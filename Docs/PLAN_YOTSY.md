# Yotsy family — plan

Sister product to Canasta / Rummy / Trick / Ichi / Skippo / Phase It. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=yotsy`).

Brand name **Yotsy** (Yahtzee-style dice parlor). Variants: Classic, Yacht, Generala, Kismet.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **yotsy** (this work) | Classic, Yacht, Generala, Kismet | Five dice · scorecard |

## Creator lock

- Yotsy tables: `Yotsy_Table.lsl` + `Yotsy_Http.lsl` → status `family:"yotsy"`.
- Table-top MoAP: `Yotsy_Display.lsl` (`?family=yotsy`).

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | 13 boxes, upper +35, Yotsy bonuses +100 |
| `yacht` | ready | 12 boxes, exact straights, FH = dice total, no bonus |
| `generala` | ready | 11 boxes, servido +5, Generala servida instant win, Doble 100 |
| `kismet` | ready | Colored pips, 15 boxes, flush, upper 35/55/75 |

Legacy stub id `dismet` normalizes to `kismet`.

BOARD wire variant chars: `c` classic, `y` yacht, `g` generala, `k` kismet.

See `RULES_YOTSY.md`.

## Multiplayer notes

- Peer ids: `yotsy-<room>-host`.
- Free-for-all; empty chairs in the chosen 1–4 seats are bots.
- Spectator MoAP shows dice, seats, and totals for observers.
