# Ichi family — plan

Sister product to Canasta / Rummy / Trick. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=ichi`).

Brand name **Ichi** (not a commercial trademark). Card language is generic.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** | Classic, Hand & Foot, Samba, Bolivia | Melds / pile / canastas |
| **rummy** | Standard, Gin, Oklahoma, Rummy 500, Kalooki | Sets + runs |
| **trick** | Hearts, Rooster, Spades, Euchre, Oh Hell | Follow suit, tricks |
| **ichi** (this work) | Classic Ichi | Match color/number, action cards |

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
6. Later: Flip / stacking house rules / jump-in.

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `classic` | ready | Match color/rank; Skip / Reverse / Draw Two / Wild / WDF; to 500 |

## Multiplayer notes

- Peer ids: `ichi-<room>-host`.
- Free-for-all; empty chairs in the chosen 2–4 seats are bots.
