# Ichi family — plan

Sister product to Canasta / Rummy / Trick. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=ichi`).

Brand name **Ichi** (not a commercial trademark). Card language is generic.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** | Classic, Hand & Foot, Samba, Bolivia | Melds / pile / canastas |
| **rummy** | Standard, Gin, Oklahoma, Rummy 500, Kalooki | Sets + runs |
| **trick** | Hearts, Rooster, Spades, Euchre, Oh Hell | Follow suit, tricks |
| **ichi** (this work) | Classic, Eights, Twin Piles, Switch, Palace, Flip | Match color/number (Ichi cards only) |

## Creator lock

- Ichi tables: `Ichi_Table.lsl` + `Ichi_Http.lsl` → status `family:"ichi"`.
- Table-top MoAP: `Ichi_Display.lsl` (`?family=ichi`).
- Same mesh / `Canasta HUD` inventory name; table status gates the web UI.
- Buyers cannot flip the family.

## Build order

1. LSL clones + `family` in JSONP — this pass.
2. Web reads `family=ichi` — this pass.
3. **Classic Ichi** solo + bots (2–4) — this pass.
4. Spectator BOARD (`I1~`) + Furware — this pass.
5. PeerJS multiplayer — this pass.
6. Variants: Eights / Twin Piles / Switch / Palace / Flip — this pass.

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | Match color/rank; Skip / Reverse / Draw Two / Wild / WDF; to 500 |
| `eights` | ready | Crazy Eights — 8s & Wilds name color; to 200 |
| `dos` | ready | Twin Piles — two discards; to 200 |
| `switch` | ready | Action ranks, stacking 2s; to 200 |
| `palace` | ready | Hand + up + down; first to 3 hand wins |
| `flip` | ready | Light/dark sides; Flip card; to 500 |

All use **Ichi color cards** (no French suits). See `RULES_ICHI_VARIANTS.md`.

## Multiplayer notes

- Peer ids: `ichi-<room>-host`.
- Free-for-all; empty chairs in the chosen 2–4 seats are bots.
