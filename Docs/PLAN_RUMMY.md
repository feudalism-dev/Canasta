# Rummy family — plan

Sister product to the Canasta parlor. **Same HUD object** (table-rezzed on sit), **same GitHub Pages app**, **creator-locked** via separate LSL scripts on the table.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** (shipped) | Classic Canasta, Hand & Foot, Samba, Bolivia | Meld books / pile / canastas |
| **rummy** (this work) | Standard, Gin, Oklahoma, Rummy 500, Kalooki (open) | Sets + runs, draw/discard, go out / knock |
| **trick** | Hearts, Rooster, Spades, Euchre | Follow suit, tricks, point bags |

Hearts / Rooster are **not** Rummy — see `Docs/PLAN_TRICK.md`.

## Creator lock

- Canasta tables keep `Canasta_Table.lsl` + `Canasta_Http.lsl` → status `family:"canasta"`.
- Rummy tables use `Rummy_Table.lsl` + `Rummy_Http.lsl` → status `family:"rummy"`.
- Table-top MoAP: use `Rummy_Display.lsl` (URL includes `family=rummy`). Keep `Canasta_Bots.lsl` as-is.
- Same mesh / same `Canasta HUD` inventory name is fine; the table status gates the web UI.
- Buyers and sitters cannot flip the family.

## Build order

1. LSL clones + `family` in JSONP status — done.
2. Web reads `family` from table status — done.
3. Standard Rummy engine + solo HUD — done.
4. Solo player count 2–4 (bots in empty seats) + PeerJS multiplayer — done (free-for-all, no teams).
5. Gin Rummy as a rummy variant (knock / undercut / gin bonuses) — done (see `Docs/RULES_GIN.md`).
6. Oklahoma Gin, Rummy 500, Kalooki (open) in the game selector — done (see `Docs/RULES_RUMMY_VARIANTS.md`).
7. Scoreboard letter(s) for rummy games; optional display polish.
8. Later: Kalooki contract hands (not open free-meld).

## Multiplayer notes

- Same table Create / Join / Ready / Start as Canasta.
- Peer ids use `rummy-<room>-host` (separate from Canasta rooms).
- Host is authoritative; empty chairs in the chosen 2–4 seats are bots.
- Standard Rummy is **not** partnership — each seat scores alone.

## Standard Rummy (v1 target)

- 2–4 players; one 52-card deck (+ jokers TBD — start **without** jokers).
- Deal 7 cards (2–4 players; adjust if we adopt a 10-card house later).
- Turn: draw stock **or** take discard top → optional meld/layoff → discard.
- Melds: set (3–4 of a rank) or run (3+ same suit, Ace high or low but not wrapping).
- Go out when hand is empty after a legal discard (or final meld).
- Deadwood / hand-end scoring: unmelded cards count against (face 10, A 1 or 15 — pick Pagat-style and document in RULES_RUMMY.md).

Gin is available in the Rummy game selector (2 players only).
