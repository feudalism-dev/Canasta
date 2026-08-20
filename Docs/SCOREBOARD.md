# Canasta scoreboard (MOAP)

A wall panel near the table. It **hears** finished games, stores high scores, and draws the list on **media** (same GitHub Pages app as the HUD). No Furware letters. Tabs are on the page.

## What it stores

Each seated **human**’s team score at **match end** (not after every hand). Computers are skipped. If you already have an entry, only a **higher** score replaces it. Top **10** per board.

**Canasta** and **Hand & Foot** are stored separately (different score scales). The page has a game tab for each.

| Board | Where | Window |
|--------|--------|---------|
| This parlor · Weekly / Monthly / Lifetime | Linkset Data on the scoreboard prim | Calendar week (Mon-aligned Unix week) / calendar month / forever |
| Network · Weekly / Monthly / Lifetime | Experience Key-Value | Same windows, shared by every scoreboard compiled with that Experience |

Experience keys are `cn.sc.c.*` (Canasta) and `cn.sc.h.*` (Hand & Foot). Older unscoped `cn.sc.w.*` / `cn.sc.m.*` / `cn.sc.l` keys are left alone (not shown).

## Table side (shout)

Drop `lsl/Canasta_Scores.lsl` in the **game table** linkset (root is fine). Compile **Mono**. The scoreboard is a **separate, unlinked** object. At `GAME_OVER` the table **`llShout`s** (100 m) one line per seated human:

```
CN_SCORE|c|<avatar-uuid>|Bandor Tyrell|8441
```

on channel **`-18475021`**. Game code is `c` (Canasta) or `h` (Hand & Foot), taken from the HUD’s `GAME_OVER|…|c` / `|h` pipe. Same channel is hard-coded in the scoreboard script. Place the panel within shout range of the table.

Recompile order on the table is still Display → Http → Table; Scores can compile anytime.

## Scoreboard object

1. Rez a **flat panel** (picture frame / wall sign). Linkset root = the media prim.
2. Media on **face 0** (`MEDIA_FACE`). Default media size is **1024×720** (landscape) so the brass frame hugs the top-10 list — reshape the prim to roughly that aspect (wider than tall), then reset the core script so media reapplies.
3. Drop **`lsl/Canasta_Scoreboard.lsl`** (core) and **`lsl/Canasta_Scoreboard_Admin.lsl`** (touch menus) on the same prim. Compile core **Mono + the same Experience as the table**; Admin needs Mono only.
4. Parcel must allow that Experience (needed for Network). Local parlor scores still work without it.
5. Whitelist `feudalism-dev.github.io` for media on the parcel.

There are **no extra buttons and no Furware meshes**. The page has:

- **Canasta** / **Hand & Foot**
- **This parlor** / **Network**
- **Weekly** / **Monthly** / **Lifetime**

Touching the prim is optional for spectators; the page polls JSONP. Network numbers refresh from Experience every few seconds.

Bump `public/asset-rev.txt` when Pages deploys so MoAP reloads **without** recompiling the HUD. Script `PAGE_ASSET_REV` / `HUD_PAGE_ASSET_REV` values are fallbacks only.

## Admin (touch the scoreboard prim — not the MOAP)

There is **no gear on the web display**. Touch the scoreboard object (owner or super-user). `Canasta_Scoreboard_Admin.lsl` opens `llDialog` menus and talks to the core over link `93001`/`93002`.

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
