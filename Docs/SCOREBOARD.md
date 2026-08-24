# Canasta scoreboard (MOAP)

A wall panel near the table. It **hears** finished games, stores high scores, and draws the list on **media** (same GitHub Pages app as the HUD). No Furware letters. Tabs are on the page.

## What it stores

Each seated **human**’s team score at **match end** (not after every hand). Computers are skipped. If you already have an entry, only a **higher** score replaces it. Top **10** per board.

**Canasta** and **Hand & Foot** are stored separately (different score scales). The page has a game tab for each.

| Board | Where | Window |
|--------|--------|---------|
| This parlor · Weekly / Monthly / Lifetime | Linkset Data on the scoreboard prim | Calendar week (Mon-aligned Unix week) / calendar month / forever |
| Network · Weekly / Monthly / Lifetime | Experience Key-Value | Same windows, shared by every scoreboard compiled with that Experience |

Experience keys are `cn.sc.c.*` (Canasta) and `cn.sc.h.*` (Hand & Foot). Older unscoped `cn.sc.w.*` / `cn.sc.m.*` / `cn.sc.l` keys are still **read as a fallback** into the Canasta Network boards when the scoped Canasta key is empty (so a freshly rezzed panel can show pre-split network scores). New writes always use the scoped keys.

## Table side (shout)

Drop `lsl/Canasta_Scores.lsl` in the **game table** linkset (root is fine). Compile **Mono**. The scoreboard is a **separate, unlinked** object. At `GAME_OVER` the table **`llShout`s** (100 m) one line per seated human:

```
CN_SCORE|c|<avatar-uuid>|Bandor Tyrell|8441
```

on channel **`-18475021`**. Game code is a **one-letter** token from the HUD’s `GAME_OVER|…|<code>` pipe (`c` Canasta, `h` Hand & Foot, `s` Samba, `b` Bolivia). `Canasta_Scores.lsl` passes that letter through (first `a–z` / `0–9` character; empty → `c`) so future games do not need another table compile. Same channel is hard-coded in the scoreboard script. Place the panel within shout range of the table.

**Samba / Bolivia (beta):** the table may shout `s` / `b`. The scoreboard **does not record** those yet (scoring may still change). The MoAP page has Samba and Bolivia tabs that say **Coming soon**. Classic and Hand & Foot boards are unchanged.

**Update both objects** if you already sold a copy: drop the new Scores script in the **table**, and the new core script in the **scoreboard**. An old scoreboard maps unknown letters to Canasta and would mix Samba scores into Classic.

Recompile order on the table is still Display → Http → Table; Scores can compile anytime.

## Scoreboard object (3-prim linkset)

Recommended link order (select all, then **click the frame last** so it becomes root):

| Prim | Name (exact) | Scripts |
|------|----------------|---------|
| **Frame** (root) | `frame` (any name ok) | `Canasta_Scoreboard.lsl` only — Mono + Experience |
| **Screen** (display) | **`screen`** (required) | none — Core finds this name and sets MoAP on face 0 |
| **Gear** (admin) | `gear` (any name ok) | `Canasta_Scoreboard_Admin.lsl` — Mono |

1. Media is applied to the child named **`screen`**, face **0** (`MEDIA_FACE`). Default media size is **1024×720** (landscape). Reshape the screen prim to roughly that aspect, then reset the core script.
2. Parcel must allow the Experience (needed for Network). Local parlor scores still work without it.
3. Whitelist `feudalism-dev.github.io` for media on the parcel.
4. Touch the **gear** (owner or super-user) for admin menus — not the MoAP screen.

The MoAP page has tabs for **Canasta** / **Hand & Foot** / **Samba** / **Bolivia**, **This parlor** / **Network**, and **Weekly** / **Monthly** / **Lifetime**. Samba and Bolivia show Coming soon until those variants leave beta. Spectators use the screen; admins use the gear. Network numbers refresh from Experience every few seconds.

Bump `public/asset-rev.txt` when Pages deploys so MoAP reloads **without** recompiling scripts. Script `PAGE_ASSET_REV` values are fallbacks only.

## Admin (touch the gear)

`Canasta_Scoreboard_Admin.lsl` on the gear opens `llDialog` menus and talks to the core over link `93001`/`93002` (`LINK_SET`).

| Who | Local (this parlor LSD) | Network (Experience) |
|-----|-------------------------|----------------------|
| **Super-user** (hard-coded UUID in the Admin script) | Clear / remove / set | Clear / remove / set |
| **Object owner** | Clear / remove / set | Refresh cache only — no writes |
| Everyone else | No menu | No menu |

Menus: Local or Network → game → period (or all periods) → Clear board / Remove player / Set score. Set score text box: `Name|score` or `uuid|Name|score`. Admin set/remove bypasses the normal “keep higher only” rule.

## Test shouter

Drop `lsl/Canasta_Score_Test.lsl` on any nearby prim (owner or super-user). Touch for sample Canasta / Hand & Foot shouts, “me” scores, or a custom `game|Name|score` line. Stay within **100 m** of the scoreboard. Remove the prim when you are done testing.

## Placement

Keep the scoreboard **within shout range (100 m)** of the tables. It is not linked to the table.
