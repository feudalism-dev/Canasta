# Trick family — plan

Sister product to Canasta / Rummy. **Same HUD object**, **same GitHub Pages app**, **creator-locked** via separate LSL scripts (`family=trick`).

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** | Classic, Hand & Foot, Samba, Bolivia | Melds / pile / canastas |
| **rummy** | Standard, Gin, Oklahoma, Rummy 500, Kalooki | Sets + runs |
| **trick** (this work) | Hearts, **Rooster**, Spades, Euchre (later) | Follow suit, tricks, points |

**Rooster** is our Rook-style game (Hasbro trademarks “Rook”). Bird theme; not a clone of the commercial deck art.

## Creator lock

- Trick tables: `Trick_Table.lsl` + `Trick_Http.lsl` → status `family:"trick"`.
- Table-top MoAP: `Trick_Display.lsl` (`?family=trick`).
- Same mesh / `Canasta HUD` inventory name; table status gates the web UI.
- Buyers cannot flip the family.

## Build order

1. LSL clones + `family` in JSONP — this pass.
2. Web reads `family=trick` — this pass.
3. **Hearts** solo + bots (4 players, pass, shoot the moon) — this pass.
4. Spectator BOARD for trick (later polish).
5. PeerJS multiplayer for trick (mirror Rummy).
6. **Rooster** — colored 1–14 nest deck, bid, partnerships (next major).
7. Spades / Euchre as later selector options.

## Variants (selector)

| Id | Status | Notes |
|----|--------|--------|
| `hearts` | ready | Avoidance; Q♠ + hearts; to 100 |
| `rooster` | stub | Rook-style; nest + bird trump; partners |
| `spades` | later | Fixed trump ♠; bid tricks |
| `euchre` | later | Short deck; partnerships |

## Multiplayer notes

- Peer ids: `trick-<room>-host`.
- Hearts is free-for-all (4 seats). Rooster / Spades / Euchre use partnerships 1+3 vs 2+4.
