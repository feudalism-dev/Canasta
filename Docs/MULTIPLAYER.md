# Multiplayer

Canasta multiplayer is **table-only** in Second Life. The public web client is solo vs computer. Match traffic uses **PeerJS** (free public broker). No paid server.

**Capacity:** 2 or 4 players at one table. A 5th join is rejected (`Room full`). 3-player is deferred.

1. Sit at the table (HUD auto-enters)
2. Host: Create Multiplayer Game → share code with seated Actives
3. Guests: Join → Ready
4. Host: Start Match (picks Canasta or Hand and Foot first)

Host is authoritative (applies moves, broadcasts state).

**Partnerships:** 4 humans → seats 0+2 vs 1+3. 2 humans → heads-up (each is their own team), regardless of which chairs they sat in.

Going out in Hand and Foot with a human partner pauses for **May I go out?** consent on the partner HUD.

If the public broker is flaky, run your own PeerServer later and point PeerJS at it.
