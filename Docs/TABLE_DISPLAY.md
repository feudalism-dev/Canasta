# In-world table display

The HUD is the rules engine. The table is a **spectator parlor**. `lsl/Canasta_Display.lsl` drives **Furware** seat lines. Prim book stacks and spectator MOAP are still later.

Seated play still **claims** the table so two matches cannot overlap.

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
| `GAME_OVER` | Match over | winning team in `team` |
| `FREEZE` | Pile freeze changed | `value` 1=frozen 0=clear |

`player` is 1–4 (seat + 1). `team` is 0 or 1. `rank` is `4`–`A`, `2`, `3R`, `3B`, `JOKER`, or `NONE`.

## Planned physical layout

- Center: stock height (prim Z or sculpt) + discard top texture
- Two team trays: rising red/black book stacks
- Furware Text: team scores, whose turn, meld minimum, round
- Optional spectator MOAP mirroring the **public** board (never hands)

Start payload (`91002`): `solo|nPlayers|humanSeat|uid0|uid1|uid2|uid3|name0|name1|name2|name3` or `match|uid0|uid1|uid2|uid3|name0|name1|name2|name3`.
