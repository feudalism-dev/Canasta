# Rummy family — plan

Sister product to the Canasta parlor. **Same HUD object** (table-rezzed on sit), **same GitHub Pages app**, **creator-locked** via separate LSL scripts on the table.

## Families (do not mix)

| Family | Examples | Engine |
|--------|----------|--------|
| **canasta** (shipped) | Classic Canasta, Hand & Foot, Samba, Bolivia | Meld books / pile / canastas |
| **rummy** (this work) | Standard Rummy → then Gin Rummy | Sets + runs, draw/discard, go out / knock |
| **trick** (later, not now) | Hearts, Rook, Spades, Euchre | Follow suit, tricks, point bags |

Hearts and Rook are **not** Rummy. They need a third family when you want them. Do not force them under `family=rummy`.

## Creator lock

- Canasta tables keep `Canasta_Table.lsl` + `Canasta_Http.lsl` → status `family:"canasta"`.
- Rummy tables use `Rummy_Table.lsl` + `Rummy_Http.lsl` → status `family:"rummy"`.
- Table-top MoAP: use `Rummy_Display.lsl` (URL includes `family=rummy`). Keep `Canasta_Bots.lsl` as-is.
- Same mesh / same `Canasta HUD` inventory name is fine; the table status gates the web UI.
- Buyers and sitters cannot flip the family.

## Build order

1. LSL clones + `family` in JSONP status (this pass).
2. Web reads `family` from table status; Canasta UI only when `canasta` (default for browser practice).
3. Standard Rummy rules engine + minimal playable HUD path.
4. Gin Rummy as a rummy variant (knock / undercut / gin bonuses).
5. Scoreboard letter(s) for rummy games; optional display polish.

## Standard Rummy (v1 target)

- 2–4 players; one 52-card deck (+ jokers TBD — start **without** jokers).
- Deal 7 cards (2–4 players; adjust if we adopt a 10-card house later).
- Turn: draw stock **or** take discard top → optional meld/layoff → discard.
- Melds: set (3–4 of a rank) or run (3+ same suit, Ace high or low but not wrapping).
- Go out when hand is empty after a legal discard (or final meld).
- Deadwood / hand-end scoring: unmelded cards count against (face 10, A 1 or 15 — pick Pagat-style and document in RULES_RUMMY.md).

Gin is **phase 2** behind the same `family=rummy` allow-list.
