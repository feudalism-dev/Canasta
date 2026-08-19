# Multiplayer

Canasta multiplayer is **table-only** in Second Life. The public web client is solo vs computer. Match traffic uses **PeerJS** (free public broker). No paid server.

**Always four hands, teams from seating.** Opposite chairs are partners (Players **1+3** vs **2+4**). Adjacent chairs are opponents. Empty chairs are computers — the host HUD plays them. 2, 3, or 4 humans can play; sit where you want the teams to be **before** Join or Start.

| Who sits | What you get |
| --- | --- |
| 1 human | Solo (use Play Solo). |
| 2 opposite | Co-op vs two computers. |
| 2 adjacent | Versus: each has a computer partner. |
| 3 | The opposite pair are a team; the singleton gets a computer opposite them. |
| 4 | Two vs two. |

The HUD shows a chair map during Create / Join so you can see who is on which team. Switch seats in AVsitter if you want a different partner — the table does not move people for you.

1. Sit at the table (HUD auto-enters)
2. Check the chair map. Switch seats if the teams are wrong.
3. Host: Create Multiplayer → share code with seated Actives
4. Guests: Join as your player number → Ready
5. Host: Start Match (picks Canasta or Hand and Foot first)

Everyone sitting must Join before Start. Host is authoritative (applies moves, including computer turns, and broadcasts state).

Going out in Hand and Foot with a human partner pauses for **May I go out?** consent on the partner HUD. A computer partner auto-allows.

If the public broker is flaky, run your own PeerServer later and point PeerJS at it.
