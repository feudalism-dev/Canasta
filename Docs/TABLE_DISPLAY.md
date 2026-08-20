# In-world table display

The HUD is the rules engine. The table is a **spectator parlor**. `lsl/Canasta_Display.lsl` drives **Furware** seat lines and the **table-top MOAP** (public board, never hole cards).

Seated play still **claims** the table so two matches cannot overlap.

## Chairs (AVsitter)

Partnerships sit **across** the table. Play is clockwise from Player 1:

| Clockwise | Seat index | Partners with |
|-----------|------------|----------------|
| Player 1 (this side of the table-top) | 0 | Player 3 |
| Player 2 (Player 1's right) | 1 | Player 4 |
| Player 3 (opposite Player 1) | 2 | Player 1 |
| Player 4 (Player 1's left) | 3 | Player 2 |

Teams: **1+3** vs **2+4** (engine: even seats vs odd seats). If AVsitter was ordered 1, 3, 2, 4 clockwise, swap the Player 2 and Player 3 poses so 1 faces 3.

The spectator MOAP is drawn from **Player 1's viewpoint** (Player 1 at the near edge). Match AVpos to that.

Linked prims named **`bot1`–`bot4`** (optional) are computer stand-ins. `Canasta_Bots.lsl` shows a bot for each computer-occupied chair at Start and hides all four on Reset and Game Over. Hide uses Blinn-Phong alpha 0 plus PBR base-color alpha 0 in blend mode, so both material paths go transparent.

## Furware

The letter meshes do nothing by themselves. Drop **one** script named **`FURWARE text`** (from the Furware kit) into the same linkset as the table. On reset you should hear `FURWARE text started with 4 set(s).`

The **table prim** (the one with Table + Http + AVsitter + `Canasta HUD` in inventory) must be the **linkset root**. If a Furware letter is root (`FURWARE text mesh:text1:0:0` in the root), unlink and link again: select the letters first, **click the table last**, then Link.

One Furware text script in the **linkset**. Four root sets, one per AVsitter seat:

| Set name | Seat | Player |
|----------|------|--------|
| `text0` | 0 | 1 |
| `text1` | 1 | 2 |
| `text2` | 2 | 3 |
| `text3` | 3 | 4 |

Prim names: `FURWARE text mesh:text0:0:0` … `text0:0:3` (and the same for `text1`–`text3`). Put `Canasta_Display.lsl` on the display child. It sends `fw_data` / `fw_conf` to those set names.

Idle line: `1 P1`. During a game: `1 Alice 50`, with a leading `*` and brass color on whose turn it is. Empty CPU seats show `CPU`. Partnership scores are shared (seats 0+2 vs 1+3).

## Table-top MOAP

The display child is the **game table top** for people who are not playing. `Canasta_Display.lsl` sets media on **face 0** (`DISPLAY_FACE` — change it if your mesh uses another face) to:

`https://feudalism-dev.github.io/Canasta/?view=table&tableId=…&uid=spec&sl_cap=…&rev=N`

The page polls JSONP `action=status` / `action=board` (~1s). When that snapshot shows a draw, pile take, meld, or discard, cards fly from the acting seat (or stock/discard) onto the books or pile. The seated HUD sends **short** `NAMES|…` and chunked `BOARD|i|n|…` events (a full snapshot in one query string was too large for MOAP JSONP, so the table top never updated). Public snapshot: names, hand counts, foot sealed/open, team scores, books, stock, discard top/size/freeze, whose turn, and a call-out like “Player 2 is drawing…”. Hole cards are never sent.

Idle / between games shows the four empty seats and the felt.

Recompile **Display → Http → Table** after dropping new table scripts. For Pages-only UI deploys, bump `public/asset-rev.txt` instead of reissuing the HUD.

## Event bus

Host or solo client emits JSONP `action=event&p=PIPE`. Table forwards `p` to Display on link `91001`.

Pipe format:

```
EVENT|player|team|rank|value|extra
```

| EVENT | When | Fields |
|-------|------|--------|
| `TURN` | Draw phase begins | player, team |
| `DRAW` | Drew from stock | player, count in `value` |
| `TAKE_PILE` | Took discard | player, pile size in `value` |
| `DISCARD` | Discarded | player, rank |
| `MELD` | New or added meld | player, team, rank, count in `value` |
| `CANASTA` | Book closed | team, rank, `value` 0=mixed/dirty 1=natural/clean 2=wild |
| `FOOT` | Picked up Foot | player |
| `THREES` | Laid red threes | team, count in `value` |
| `SCORE` | Round scored | team0 in `player`, team1 in `team` as scores via extra `t0|t1` in extra |
| `GAME_OVER` | Match over | winning team in `team`; `extra` is `c` (Canasta) or `h` (Hand & Foot) for the scoreboard |
| `FREEZE` | Pile freeze changed | `value` 1=frozen 0=clear |
| `NAMES` | Roster labels | name0–name3 (AI included) |
| `BOARD` | Spectator snapshot chunk | `i|n|chunk` — Http concatenates (not Table, to stay under Mono heap) |

`player` is 1–4 (seat + 1). `team` is 0 or 1. `rank` is `4`–`A`, `2`, `3R`, `3B`, `JOKER`, or `NONE`.

At match end, `Canasta_Scores.lsl` **llShout**s (100 m, channel `-18475021`) `CN_SCORE|c|uuid|Name|1234` (or `h` for Hand & Foot) for each seated human. See [SCOREBOARD.md](SCOREBOARD.md).

HTTP `action=board` GET is answered by **Http** from the stored snapshot. Host/solo writes it via `BOARD` chunks. Table reset sends `BCLR|` so the snapshot clears. Status JSONP also includes `board`.

Start payload (`91002`): `solo|nPlayers|humanSeat|uid0|uid1|uid2|uid3|name0|name1|name2|name3` or `match|uid0|uid1|uid2|uid3|name0|name1|name2|name3`. Names are the last four fields. Table sends the HTTP-IN URL to Display on `91005`.
