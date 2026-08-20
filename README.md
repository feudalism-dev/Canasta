# Hand & Foot / Canasta

Classic Canasta and popular American Hand and Foot — solo vs computer in any browser, and table-only multiplayer in Second Life.

**Stack:** React + TypeScript + Vite  
**Host:** GitHub Pages (free)  
**Browser:** Chromium / CEF 139+

Paid access is sold in Second Life; this web client is free to build and host.

## Local play

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173/Canasta/).

```bash
npm test
npm run build
npm run preview
```

## Multiplayer

Multiplayer is **table-only** in Second Life: sit at a Canasta table, check the chair map (opposite = partners, empty chairs = computers), then Create or Join. Friends at the same table Ready → Host Start Match. Uses PeerJS over the public broker (no paid backend).

This site (the public URL, not seated) is **solo vs computer only**.

## GitHub Pages

1. Push this repo to GitHub as **Canasta** (or set `base` in `vite.config.ts` to match the repo name).
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main` — the workflow deploys `dist`.

Site: `https://<you>.github.io/Canasta/`

## Docs

- [RULES.md](Docs/RULES.md)
- [DESIGN.md](Docs/DESIGN.md)
- [SECOND_LIFE.md](Docs/SECOND_LIFE.md) — MOAP HUD, table lock, Active / Create / Join
- [MULTIPLAYER.md](Docs/MULTIPLAYER.md)
- [TABLE_DISPLAY.md](Docs/TABLE_DISPLAY.md) — chairs, Furware, table-top spectator MOAP
- [SCOREBOARD.md](Docs/SCOREBOARD.md) — parlor / network high scores (MOAP)
- [ASSETS.md](Docs/ASSETS.md)
- [DEFERRED.md](Docs/DEFERRED.md)

## Second Life (in-world)

1. Put `lsl/Canasta_Table.lsl`, `lsl/Canasta_Http.lsl`, `lsl/Canasta_Bots.lsl`, and `lsl/Canasta_Scores.lsl` on the game table root (with AVsitter; seats 0–3; linked prims named `bot1`–`bot4`). Put `lsl/Canasta_Display.lsl` on the **display child** (Furware sets `text0`–`text3`). Compile Table + HUD with your **Experience**. Optional wall **scoreboard**: link **frame** (root, `Canasta_Scoreboard.lsl`) + child named **`screen`** (MoAP) + **gear** (`Canasta_Scoreboard_Admin.lsl`). Dev helper: `lsl/Canasta_Score_Test.lsl` shouts sample `CN_SCORE` lines.
2. Build HUD object named **`Canasta HUD`** (square, media face **4**), put `lsl/Canasta_HUD.lsl` in it (same Experience), then put that object in the **table** inventory.
3. Whitelist `feudalism-dev.github.io` for media; bump `public/asset-rev.txt` after Pages deploys (no HUD reissue).
4. Sit → table rezzes/attaches HUD → lobby (auto-enter).

Recompile order: Display → Http → Table.

Details: [Docs/SECOND_LIFE.md](Docs/SECOND_LIFE.md).
