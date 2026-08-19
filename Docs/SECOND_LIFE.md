# Canasta — Second Life Integration

## Architecture

| Layer | Role |
|--------|------|
| **AVsitter** | Sit poses only (`90070` / `90065`). Does **not** attach the HUD. |
| **Table LSL** | Roster, **rezzes HUD**, one-game lock, display reset handshake |
| **Http LSL** | HTTP-IN JSONP (same root prim as Table) |
| **Display LSL** | Furware seat lines (`text0`–`text3`); prim books / spectator MOAP later |
| **HUD LSL** | Experience **temp-attach** → set MOAP URL (Pages) |
| **MOAP (React)** | Seated HUD always claims the table; public URL is solo-only |
| **PeerJS** | Browser↔browser match traffic (not via the table) |

```
Sit → AVsitter 90070
Table → llRezObject("Canasta HUD") + CN_READY handshake on rez channel
HUD → Experience → llAttachToAvatarTemp → MoAP https://…/Canasta/?tableId&seat&uid&sl_cap&…
JS → Http JSONP → Table (lock / events) → Display
Browsers → PeerJS for multiplayer moves
```

**Inventory**

- **Table root:** `Canasta_Table.lsl` + `Canasta_Http.lsl` + AVsitter; HUD object **`Canasta HUD`** in table inventory. Compile Table + HUD with the **same Experience**.
- **Display child:** `Canasta_Display.lsl` (Mono). Furware sets `text0`–`text3` plus **one** `FURWARE text` script in the same linkset. Table prim must stay the linkset root.
- Root description contains `canasta-table`.

Parcel must allow that Experience.

## Hard rules

1. **Sit ≠ Active.** HUD attach ≠ playable until the web client **enters** (auto on load, Retry if the table link was late).
2. **Seated play always claims the table.** Solo vs AI from the HUD locks the table. There is no HUD-only ghost match overlapping another game.
3. **Public URL (not seated)** is solo vs computer only. Multiplayer is table-only — Create/Join require Active players at that table.
4. **One table, one game.** At most one claimed Solo or one MP match (or its lobby) per table.
5. **MP only among Actives** who Create/Join that match. Non-joiners wait for the next game.
6. **Post-game:** first Active to **Create** wins host (no sticky host).
7. **Channels:** table-scoped bus + `llRegionSayTo` + `uid` in payload (no cross-table crosstalk).

## LSL ↔ LSL (chat)

**Command channel** (per avatar):

```lsl
(integer)("0x" + llGetSubString((string)av, -8, -1)) * -1
```

**Table → HUD** (`llRegionSayTo`):

```
CN_READY|tableId|seat|uid|slCap|displayName
CN_DETACH|tableId
```

**HUD → Table:**

```
CN_HELLO|uid
```

## JS ↔ Table (HTTP-IN JSONP)

`Canasta_Http.lsl` owns the URL and JSONP responses. Mutating actions are forwarded to Table on link `92001`.

Query params: `action`, `cb`, `uid`, `name`, `seat`, plus action-specific fields.

| action | Purpose |
|--------|---------|
| `status` | Roster, active list, lock mode, room code (if lobby/match) |
| `enter` | Become Active |
| `leave` | Leave Active / lobby |
| `claim_solo` | Lock table for Solo. Optional `players=2` or `4`. |
| `end_game` | Release lock |
| `create` | Mint room code; caller = host; table → lobby |
| `join` | Join open lobby |
| `start` | Host starts MP (need ≥2 joined) |
| `event` | Display bus: pipe payload in `p=` (see `TABLE_DISPLAY.md`) |

Response shape: `callback({ ok, ... });`

### Link numbers

| Num | Dir | Meaning |
|-----|-----|---------|
| `91001` `DISPLAY_CMD_EVENT` | Table → Display | `str` = pipe event |
| `91002` `DISPLAY_CMD_START` | Table → Display | solo/match start pipe |
| `91003` `DISPLAY_CMD_RESET` | Table → Display | Idle / attract |
| `91004` `DISPLAY_RSP_RESET_DONE` | Display → Table | Reset complete |
| `92001` `HTTP_CMD` | Http ↔ Table | `REQ` / `RESP` / `STATUS` / `CAP` |

`claim_solo`, `create`, and `start` put the table in mode `resetting`, send Display `91003`, and hold the JSONP response until Display replies `91004` or a short timeout.

### Recompile order

1. `Canasta_Display.lsl`
2. `Canasta_Http.lsl`
3. `Canasta_Table.lsl`
4. `Canasta_HUD.lsl` (HUD object)

## HUD object

Square prim, media on **face 4**, 1024×1024. Object name **`Canasta HUD`**. Same Experience as the table.

Whitelist `feudalism-dev.github.io` on the parcel. Bump `HUD_PAGE_ASSET_REV` after Pages deploys.
