# Parlor scoreboard (MOAP)

A wall panel near the tables. It **hears** finished games, stores high scores, and draws the list on **media** (same GitHub Pages app as the HUD). No Furware letters. Game / range / period controls are on the page.

## What it stores

Each seated **human**’s score at **match end** (not after every hand). Computers are skipped. If you already have an entry, only a **higher** score replaces it. Top **10** per board.

Boards are **separate** by one-letter game code (different score scales must not mix).

| Code | Board |
|------|--------|
| `c` | Classic Canasta |
| `h` | Hand & Foot |
| `s` | Samba |
| `b` | Bolivia |
| `r` | Rummy |
| `t` | Rooster family (Hearts, Rooster, Spades, Euchre, Oh Hell) |
| `i` | Ichi |
| `o` | Skippo |
| `p` | Phase It |
| `y` | Yotsy |

| Board | Where | Window |
|--------|--------|---------|
| This parlor · Weekly / Monthly / Lifetime | Linkset Data on the scoreboard prim | Calendar week (Mon-aligned Unix week) / calendar month / forever |
| Network · Weekly / Monthly / Lifetime | Experience Key-Value | Same windows, shared by every scoreboard compiled with that Experience |

Experience keys are `cn.sc.<code>.*` (e.g. `cn.sc.t.w.…` for Rooster weekly). Older unscoped `cn.sc.w.*` / `cn.sc.m.*` / `cn.sc.l` keys are still **read as a fallback** into the Canasta Network boards when the scoped Canasta key is empty. New writes always use the scoped keys.

## Table side (shout)

Drop the matching `*_Scores.lsl` in each **game table** linkset (root is fine). Compile **Mono**. The scoreboard is a **separate, unlinked** object. At `GAME_OVER` the table **`llShout`s** (100 m) one line per seated human:

```
CN_SCORE|t|<avatar-uuid>|Bandor Tyrell|8441
```

on channel **`-18475021`**. Game code is a **one-letter** token from the HUD’s `GAME_OVER|…|<code>` pipe. Scores scripts pass that letter through (first `a–z` / `0–9` character; empty → the family default). Same channel is hard-coded in the scoreboard script. Place the panel within shout range of the tables.

**Update the wall scoreboard** (Core + Http + Admin) when adding new letters. An old Http script maps unknown letters to Canasta and would mix scores.

## Scoreboard object (3-prim linkset)

Recommended link order (select all, then **click the frame last** so it becomes root):

| Prim | Name (exact) | Scripts |
|------|----------------|---------|
| **Frame** (root) | `frame` (any name ok) | `Canasta_Scoreboard.lsl` (Mono + Experience) **and** `Canasta_Scoreboard_Http.lsl` (Mono) |
| **Screen** (display) | **`screen`** (required) | none — Http finds this name and sets MoAP on face 0 |
| **Gear** (admin) | `gear` (any name ok) | `Canasta_Scoreboard_Admin.lsl` — Mono |

HTTP-IN and MoAP live in the thin **Http** script so JSONP has enough Mono heap. The core only stores scores / Experience / admin. If the panel shows “cannot reach scoreboard” after a reset, check owner chat for `HTTP-IN ready` **and** `Free=` on the Http script (needs thousands of bytes free, not ~1k).

1. Media is applied to the child named **`screen`**, face **0** (`MEDIA_FACE`). Default media size is **1024×720** (landscape). Reshape the screen prim to roughly that aspect, then reset the **Http** script.
2. Parcel must allow the Experience (needed for Network). Local parlor scores still work without it.
3. Whitelist `feudalism-dev.github.io` for media on the parcel.
4. Touch the **gear** (owner or super-user) for admin menus — not the MoAP screen.
5. After editing scripts: drop/reset **both** Core and Http on the frame (Http owns the URL the MoAP page calls).

The MoAP page has a **game dropdown**, plus **This parlor** / **Network**, and **Weekly** / **Monthly** / **Lifetime**. Spectators use the screen; admins use the gear. Network numbers refresh from Experience every few seconds.

Bump `public/asset-rev.txt` when Pages deploys so MoAP reloads **without** recompiling scripts. Script `PAGE_ASSET_REV` values are fallbacks only.

The MoAP page **caches** the last successful parlor/network snapshot in the viewer’s local storage. If HTTP-IN drops (region restart, stale URL), it keeps showing that cache and retries in the background until the link works again.

## Admin (touch the gear)

`Canasta_Scoreboard_Admin.lsl` on the gear opens `llDialog` menus and talks to the core over link `93001`/`93002` (`LINK_SET`).

| Who | Local (this parlor LSD) | Network (Experience) |
|-----|-------------------------|----------------------|
| **Super-user** (hard-coded UUID in the Admin script) | Clear / remove / set | Clear / remove / set |
| **Object owner** | Clear / remove / set | Refresh cache only — no writes |
| Everyone else | No menu | No menu |

Menus: Local or Network → game (two pages) → period (or all periods) → Clear board / Remove player / Set score. Set score text box: `Name|score` or `uuid|Name|score`. Admin set/remove bypasses the normal “keep higher only” rule.

## Test shouter

Drop `lsl/Canasta_Score_Test.lsl` on any nearby prim (owner or super-user). Touch for sample shouts, “me” scores, or a custom `game|Name|score` line. Stay within **100 m** of the scoreboard. Remove the prim when you are done testing.

## Placement

Keep the scoreboard **within shout range (100 m)** of the tables. It is not linked to the table.
