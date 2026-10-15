# Row! Sham! Bo! family — plan

Sister product to Canasta / Rummy / Trick / Ichi / Skippo / Phase It / Yotsy. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=rowshambo`) or hub entitlement.

Brand name **Row! Sham! Bo!** (directional Rock–Paper–Scissors with Dynamite).

## Creator lock

- Tables: `RowShamBo_Table.lsl` + `RowShamBo_Http.lsl` → status `family:"rowshambo"`.
- Table-top MoAP: `RowShamBo_Display.lsl` (`?family=rowshambo`).
- Scores: `RowShamBo_Scores.lsl` shouts letter **`w`**.
- Hub: Parlor Register `GRANT_FAMILY = "rowshambo"`.

## Variants

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | 52 cards; pass+play; CW/CCW random each hand; match to 100–500 |
| `elements` | ready | 64-card deck + Water/Earth/Fire; in-game beat key |
| `triples` | hidden | Three face-down slots (not in picker yet) |

BOARD wire prefix: `W1~`. Scoreboard letter: `w`.

See `RULES_ROWSHAMBO.md` and `Row! Sham! Bo! Specification`.

## Multiplayer

- Peer ids: `rowshambo-<room>-host`.
- Free-for-all; 2–4 seats; empty chairs are bots.
