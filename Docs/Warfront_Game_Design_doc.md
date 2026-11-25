# WARFRONT
## Game Design & Functional Specification
### Second Life – Parlor Table Game Collection

**Document Type:** Game Design and Functional Requirements  
**Game Family slug:** `warfront`  
**Product name:** Warfront  
**Platform:** Second Life Parlor table (MoAP HUD + tabletop display) + browser solo  
**Players:** 1–4 (humans and/or bots in empty seats)  
**Game type:** Turn-based theater command — simplified Axis & Allies–style (original IP; not A&A geography or branding)

**Aliases (normalize to `warfront`):** `war-front`, `war_front`, `wf`, `theater`, `theatercommand`

---

# PART 1 – OBJECTIVE AND ARCHITECTURE

## 1.1 Objective

Add a new parlor family where players contest a **symmetric fictional map**, collect **Production Points (PP)** from facilities, buy and place units, move into adjacent zones, resolve combat, and race for **Victory Points (VP)**.

Two theater modes live under one family (mode flag, shared engine):

| Mode | Theater | Facilities | Capture rule |
|------|---------|------------|--------------|
| `land` | Continental | **Depots** | Ground units occupy after combat |
| `sea` | Oceanic | **Ports** (port islands in sea zones) | Surface units occupy after combat |

## 1.2 Architecture constraints (mandatory)

Mirror **Battle Fleet** registration and session patterns:

| Layer | Pattern |
|-------|---------|
| Family lock | `src/core/family.ts` — slug, labels, ad art, entitlements |
| Core | `src/core/warfront/` — types, map, state, rules, publicBoard |
| Bot | `src/ai/warfrontBot.ts` |
| Local solo | `src/ui/warfrontLocalSession.ts` |
| Peer MP | `src/net/warfrontPeerSession.ts` (host-authoritative PeerJS) |
| SL display | `src/sl/warfrontDisplaySync.ts` → compact BOARD wire |
| HUD UI | `src/ui/WarfrontBoard.tsx`, `WarfrontSetup.tsx` |
| Table MoAP | `WarfrontSpectator.tsx` via `SpectatorTable` |
| App wiring | `App.tsx`, `SlTableScreens`, entitlements / picker |

**Do not** invent a separate lobby, seating, or room-code system. Reuse Parlor table + PeerJS like Battle Fleet.

**LSL register:** optional product box sets `GRANT_FAMILY = "warfront"` in `Parlor_Register.lsl` (no hub allowlist edit required).

**Board wire budget:** ~**1600** chars (`Parlor_Http` BOARD store). Encode dense compact state (prefix `W1~`), never large JSON in status.

**Camera is local only** — pan/zoom/minimap never enter the board wire or peer state.

---

# PART 2 – MODES AND SEATING

## 2.1 Player count

- 2–4 seats in play (solo fills empty seats with bots).
- 1 human + bots is valid.
- Multiplayer: empty physical seats become bots when the host starts (Battle Fleet pattern).

## 2.2 Alignment

| Mode | Rules |
|------|--------|
| **FFA** | Every seat is independent. Last standing / first to VP wins alone. |
| **2v2 teams** | Exactly 4 players. **Opposite seats are partners** (`teamOfSeat`: even vs odd). Shared VP pool per team; allies do not attack each other; jointly win/lose. |

## 2.3 Theater flag

`config.theater: 'land' | 'sea'` — same turn loop; unit catalogs and facility names differ.

---

# PART 3 – MAP SPECIFICATION

## 3.1 Principles

- **Symmetric** uniform map (not Earth / not A&A board).
- Target **28 zones** (range 24–36 OK).
- Fixed adjacency graph + 2D layout coords for HUD/SVG.
- Exactly **one facility** per starting home sector; additional facilities on key interior zones.

## 3.2 Land map — “Crossroads” (v1)

- **28 territories** on a 4-way radial grid.
- **4 home depots** at cardinal homes (seats 0–3).
- **4 interior depots** on the inner ring (contestable economic prizes).
- Remaining zones are ordinary land with no facility.
- Adjacency: orthogonal neighbors in layout space (no wrap).

Each player starts owning:

- Home depot zone
- Two adjacent satellite zones

## 3.3 Sea map — “Archipelago” (v1)

Same topology as land with theater flag `sea`:

- Zones are **sea zones**
- Facilities are **ports** on designated island zones
- Same ownership / PP / VP rules

(Sea unit catalog replaces land; capture requires **surface** occupation — Subs alone cannot flip a zone.)

## 3.4 Stack cap

**Max 8 units** total per zone (all owners counted separately only during combat; after combat only one owner’s stack remains). Soft UI warning at cap; illegal place/move rejected by rules.

---

# PART 4 – UNITS

## 4.1 Land catalog

| Unit | Cost (PP) | Atk | Def | Notes |
|------|-----------|-----|-----|-------|
| Infantry | 3 | 1 | 2 | Cheap occupation |
| Anti-tank | 4 | 2* | 1 | *+1 atk vs enemy Tanks in same combat |
| Tank | 6 | 3 | 2 | Breakthrough |
| Artillery | 5 | 0† | 1 | †Ranged: bombard adjacent enemy zone; **cannot capture alone** |

## 4.2 Sea catalog

| Unit | Cost (PP) | Atk | Def | Notes |
|------|-----------|-----|-----|-------|
| Escort | 3 | 1 | 2 | Surface |
| Sub | 5 | 2 | 1 | Surface? No — **sub**; cannot alone occupy/flip |
| Capital | 8 | 3 | 3 | Surface capital ship |
| Carrier | 7 | 0† | 2 | †Ranged strike adjacent; **cannot capture alone** |

## 4.3 Starting armies (land)

Per player at setup:

- Home depot: **4 Infantry, 1 Tank, 1 Artillery**
- Each satellite: **2 Infantry**

Sea start (when implemented): home port **3 Escort, 1 Capital, 1 Carrier**; satellites **2 Escort**.

---

# PART 5 – ECONOMY AND VP

## 5.1 Income (step 1 of turn)

At turn start for the active player (or team?):

- **+1 PP** per owned depot/port zone
- **+1 VP** per owned depot/port zone (awarded at income)

Unspent PP carries between turns (bank).

## 5.2 Buy & place (step 2)

- Spend PP on units from the theater catalog.
- **Place only** in owned facility zones (depot/port), respecting stack cap.
- May buy zero units.
- Placement is immediate (no separate “mobilization” delay in v1).

## 5.3 Win conditions

Checked after each seat’s turn (and after combat that eliminates a player):

1. **VP race:** first player (or team) to **`VP_TO_WIN = 12`** wins.
2. **Elimination:** if only one FFA player (or one team) still controls ≥1 zone **or** has ≥1 unit, they win.
3. Optional timeout (open): round cap — deferred.

---

# PART 6 – TURN SEQUENCE

Strict order for the active seat:

1. **Income** — PP + VP from owned facilities (automatic).
2. **Buy / Place** — optional purchases into owned facilities.
3. **Ranged** — optional: Artillery (land) or Carrier (sea) strikes **one** adjacent enemy-occupied zone (resolve as one combat round of bombard hits only; no advance).
4. **Move / Combat** — **one** move: select a stack (or subset) from an owned zone into an **adjacent** zone.
   - Empty / friendly (own or ally): occupy / reinforce.
   - Contested: resolve combat; if attacker remains and defender wiped, **zone flips** to attacker.
5. **VP / elimination check** → advance to next seat in turn order.

No multi-move blitz in v1. No strategic rail. No tech tree.

---

# PART 7 – COMBAT

## 7.1 Design goals

Keep resolution fast and readable on MoAP:

- Each unit contributes attack or defense strength.
- Each unit rolls **1d6**; hit if roll **≤ strength** (capped at 6).
- Simultaneous volleys; remove casualties; repeat until one side has 0 units **or** a max of **6 rounds** (then defender holds; attacker returns to origin — v1 simplification: attacker wiped or retreats to origin with survivors).

**v1 simplification (implemented):** fight to the end (wipe); attacker never “retreats mid-fight” — if both remain after 6 rounds, **defender holds** and attacker survivors bounce back to origin.

## 7.2 Capture

Zone ownership flips only if:

- Attacker has ≥1 **occupation-capable** unit remaining in the zone after combat, and
- No enemy units remain.

Occupation-capable:

- Land: Infantry, Anti-tank, Tank (not Artillery alone)
- Sea: Escort, Capital (not Sub/Carrier alone)

## 7.3 Friendly fire / teams

Allies never fight. Moving into ally zone is reinforce (shared? **v1:** zones have single owner — allies may not enter ally zones; only own/empty/enemy). Open question if teams share territory — see §12.

**v1 decision:** territories have one owner; allies cannot enter each other’s zones (prevents stack merging complexity). Team VP is sum of members’ VP.

---

# PART 8 – HUD CAMERA (REQUIRED)

Local-only camera controller on the main map:

| Control | Behavior |
|---------|----------|
| Pan | Drag on map; UDLR keys |
| Zoom | Wheel / +/− buttons |
| Minimap | Full map thumbnail + **viewport rect**; click jumps camera |
| Recenter | Button → home depot/port; second mode → selection |
| Selection | Click territory → select; shows stacks + actions |

Camera transform is React state only — **not** in `WarfrontState`, peer wire, or BOARD payload.

---

# PART 9 – TABLETOP OVERVIEW

Table MoAP shows a **zoomed-out** public view:

- Zone ownership tint
- Facility markers (depot/port)
- Stack size dots (not full unit roster)
- Turn / scores / last message

Detail unit management stays on HUD.

---

# PART 10 – BOT AI (OUTLINE)

Priority loop for active computer seat:

1. Income is automatic.
2. **Spend PP:** prefer Infantry to fill weakest owned facility; then Tank if PP≥6 and a frontline exists; else Artillery if a ranged shot is available next.
3. **Ranged:** if Artillery present and adjacent enemy stack strength &lt; own potential hits, fire.
4. **Move:** attack adjacent enemy zone where `ownAtkEstimate > enemyDefEstimate * bias` (easy 1.4, normal 1.1, hard 0.95); else reinforce a threatened depot; else skip move and end turn.
5. Always **end turn** if no legal attack/reinforce.

---

# PART 11 – SYNC / WIRE BUDGET

## 11.1 Compact BOARD (`W1~`)

Sketch (keep under ~1500 posted / 1600 store):

```
W1~live~theater~align~pc~phase~turnSeat~msg~winSeat~winTeam^players^zones
```

- `players`: `name:seat:bot:team:pp:vp:elim` CSV
- `zones`: packed ownership + facility + stack counts per zone (base36 / nibble packing)

Private unit detail stays in peer/host state; table gets public aggregates only.

## 11.2 Peer session

Host-authoritative: clients send moves; host applies `applyWarfrontMove` and broadcasts sanitized state. Same lobby/ready/start pattern as Battle Fleet.

## 11.3 Display sync

Debounced `tableSetBoard` + NAMES / SCORE / TURN / GAME_OVER events — copy Battle Fleet debounce discipline.

---

# PART 12 – OPEN QUESTIONS

1. **Team territory sharing** — allow ally entry / shared ownership? (v1: no)
2. **VP from income only vs also capture bonuses** — (v1: income only)
3. **Sea fog / sub stealth** — deferred
4. **Partial stack moves** — (v1: yes, select counts in UI)
5. **Round cap / draw** — deferred
6. **Exact wire packing** — finalize after measuring real payloads in tests
7. **Art Deco chrome vs Battle Fleet navy** — Warfront uses warm brass / olive command palette to differentiate

---

# PART 13 – ACCEPTANCE (v1 land solo)

- [x] Family registered as `warfront`
- [x] Land map generate + setup
- [x] Income → buy → place → ranged → move/combat → end turn
- [x] HUD pan/zoom/minimap
- [x] Solo vs bots playable
- [ ] Sea theater fully polished
- [ ] 2v2 thoroughly playtested
- [ ] Peer + DisplaySync production-hardened
- [ ] LSL product packaging / ad art final

See also: `Docs/STATUS-warfront.md`
