# In-world table display (v1 stub, full visual later)

The HUD is the rules engine. The table is a **spectator parlor**. Until Furware and prim books are built, `lsl/Canasta_Display.lsl` acknowledges reset/start and ignores events (or owner-says them when `DEBUG` is true).

Seated play still **claims** the table so two matches cannot overlap.

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

Start payload (`91002`): `solo|nPlayers|humanSeat|uid0|uid1|uid2|uid3` or `match|uid0|uid1|uid2|uid3`.
