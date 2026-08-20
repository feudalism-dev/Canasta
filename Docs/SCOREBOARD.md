# Canasta scoreboard (MOAP)

A wall panel near the table. It **hears** finished games, stores high scores, and draws the list on **media** (same GitHub Pages app as the HUD). No Furware letters. Tabs are on the page.

## What it stores

Each seated **human**’s team score at **match end** (not after every hand). Computers are skipped. If you already have an entry, only a **higher** score replaces it. Top **10** per board.

| Board | Where | Window |
|--------|--------|---------|
| This parlor · Weekly / Monthly / Lifetime | Linkset Data on the scoreboard prim | Calendar week (Mon-aligned Unix week) / calendar month / forever |
| Network · Weekly / Monthly / Lifetime | Experience Key-Value | Same windows, shared by every scoreboard compiled with that Experience |

## Table side (shout)

Drop `lsl/Canasta_Scores.lsl` in the **game table** linkset (root is fine). Compile **Mono**. It listens for `GAME_OVER` and region-says:

```
CN_SCORE|1|<avatar-uuid>|<display-name>|<team-score>
```

on channel **`-18475021`**. Same channel is hard-coded in the scoreboard script.

Recompile order on the table is still Display → Http → Table; Scores can compile anytime.

## Scoreboard object

1. Rez a **flat panel** (picture frame / wall sign). Linkset root = the media prim.
2. Media on **face 0** (`MEDIA_FACE` in the script — change it if your mesh uses another face).
3. Drop **only** `lsl/Canasta_Scoreboard.lsl`. Compile **Mono + the same Experience as the table**.
4. Parcel must allow that Experience (needed for Network). Local parlor scores still work without it.
5. Whitelist `feudalism-dev.github.io` for media on the parcel.

There are **no extra buttons and no Furware meshes**. The page has:

- **This parlor** / **Network**
- **Weekly** / **Monthly** / **Lifetime**

Touching the prim is optional; the page polls JSONP. Network numbers refresh from Experience every few seconds.

Bump `PAGE_ASSET_REV` in `Canasta_Scoreboard.lsl` when Pages deploys so the panel reloads.

## Placement

Keep the scoreboard in the **same region** as the tables (the table uses `llRegionSay`). One panel can hear every table in the region.
