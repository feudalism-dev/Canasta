# Seated browser multiplayer — design & plan

Status: **proposal for review** (not implemented).  
Goal: let a player who is **physically seated / Active at a Canasta table** play the **multiplayer match in an external web browser**, using a **table-minted URL**, without opening public web multiplayer to anyone with a room code.

Related problem: some SL MoAP/CEF clients fail PeerJS/WebRTC while the same user can play **solo** and a normal desktop browser often can PeerJS fine.

---

## 1. Goals and non-goals

### Goals

1. Seated player can continue an in-world lobby/match from **Chrome/Firefox/Edge** (or viewer-opened system browser).
2. Preserve the product rule: **you must be at this table** (sat + Active, and for MP: Joined when required).
3. Room code alone is **not** enough to join from the public web.
4. Prefer **minimal new infra**: reuse table HTTP-IN + existing PeerJS; no PeerServer/TURN required for v1.
5. HUD does not run a second live game client while browser plays (park / spectator-safe).

### Non-goals (v1)

- Public web multiplayer for people not at a table.
- Replacing PeerJS with table-relayed moves (separate project).
- Hosting a private PeerServer/TURN (optional later if browser still fails).
- Cross-region / multi-table browser spectating.

---

## 2. Current state (what already exists)

| Piece | Today |
|--------|--------|
| Public URL `?client=web` | Solo vs computer only |
| Table HUD session | `tableId` + `uid` + `sl_cap`; `isTableHudSession` **rejects** `client=browser` / `web` |
| Chrome **Play in Browser** | Opens/copies **solo** URL via `standalonePlayUrl`; parks HUD messaging is solo-oriented |
| `buildSessionUrl(..., { client: 'browser', room })` | Exists but is **not** a full seated-MP path |
| MP Create/Join/Start | Table JSONP + PeerJS room `canasta-{CODE}-host` |
| Leave lobby | Undoes table Join + tears down PeerJS (recent) |

So this feature is **not** greenfield: we extend minting + gate browser into the **same** table + PeerJS room the HUDs use.

---

## 3. Product rules (proposed)

1. **Sit ≠ play.** Browser mint still requires **Active** (`enter`) at that table.
2. **Mint only while** table mode is `lobby` or `match`, and caller is on the roster for that `uid`/`seat`.
3. **MP Join still required** before Start for non-hosts (unchanged). Browser may Join via table JSONP using the minted session’s `uid`/`sl_cap`, or mint only after Join (see open question A).
4. **Token is mandatory** on browser MP URLs. Room code without valid token → reject.
5. **One live controller per seat:** when browser session claims, HUD parks (existing parked UX pattern).
6. **Stand / leave / host dissolve** invalidates tokens for that avatar (and all tokens if lobby ends).
7. **Token TTL** short (recommend **10 minutes** unused; extend or remint while match live — see open question B).

---

## 4. Architecture

```
[Seat in SL] → HUD MoAP (lobby)
       │
       ├─ Create / Join / Ready  (table JSONP + PeerJS)   ← unchanged
       │
       └─ "Play match in browser" (when peer flaky or user prefers)
              │
              ▼
        table action: mint_browser
              │  stores token on table (LSD or script globals)
              ▼
        URL: Pages + tableId, uid, seat, sl_cap, room, client=browser, token=…
              │
              ▼
        External browser opens URL
              │
              ├─ claim_browser (JSONP) → table validates token, marks seat "browser"
              ├─ HUD → parked (MoAP or LL dialog path)
              ├─ enter/status as today (same uid)
              └─ joinPeerRoom(room) / createPeerHost if host
                    │
                    ▼
              PeerJS match UI in real browser CEF/Chromium
```

**Authority split (unchanged conceptually):**

- **Table LSL:** who may sit, Active, Joined, room code, mint/claim/revoke tokens.
- **PeerJS:** lobby names/ready + match moves (host-authoritative), same as today.
- **Browser client:** another PeerJS peer for that avatar uid/seat, not a second table identity.

---

## 5. Security model

### Threat: room code leaked in chat / on screen

Mitigation: `token` required; random unguessable (e.g. 16+ bytes hex from `llGenerateKey` fragment + unix time salt, or two keys concatenated / hashed).

### Threat: replay of old URL after stand

Mitigation: clear token on stand/forfeit/`leave`/lobby dissolve; `claim_browser` checks still seated + Active (+ Joined if we require it).

### Threat: two browsers + HUD all driving one seat

Mitigation: single `gBrowserUid` / per-seat flag; new claim revokes previous; HUD parks on mint or claim.

### Threat: token in URL referrer / history

Mitigation: short TTL; optional one-time claim (token consumed → replace with session cookie in `sessionStorage` only). Prefer **one-time claim** for v1.

### Not solved by this design

Symmetric NAT that blocks WebRTC in **all** browsers → still need TURN or table relay.

---

## 6. API design (table HTTP-IN)

Add actions (names bikeshed-able):

### `mint_browser`

**Who:** seated Active `uid` matching `seat` hint.  
**When:** `lobby` or `match`.  
**Does:**

- Generate `token`, store `{ token, uid, seat, roomCode, exp, used=0 }`
- Return JSONP: `{ ok, token, roomCode, exp, urlHint? }`

Client builds URL on Pages (don’t rely on LSL to know Pages base; JS already knows `WEB_URL` / `location`).

### `claim_browser`

**Params:** `uid`, `seat`, `token`, `room` (optional check).  
**Does:**

- Validate token, not expired, not used (if one-time), uid/seat/room match, still seated Active
- Mark used; set seat “browser claimed”
- Return `{ ok, roomCode, hostUid, mode, roster… }` (status-shaped)

### `status` (extend)

Optional fields: `browserClaimed: boolean` per roster row, or `browserUid` list — so other HUDs know that seat is on browser.

### Revocation (no new action required if hooked into existing)

Clear tokens in: `forfeitAvatar`, `releaseGameLock`, stand clear, `leave`.

---

## 7. URL shape

```
https://feudalism-dev.github.io/Canasta/
  ?tableId=<table-uuid>
  &uid=<avatar-uuid>
  &seat=<0-3>
  &sl_cap=<urlencoded http-in>
  &room=<ROOMCODE>
  &client=browser
  &token=<minted>
  &name=<optional display>
  &rev=<asset-rev>
```

**Bootstrap changes:**

- Parse `token`.
- New session class e.g. `isSeatedBrowserSession(boot)`:
  - `client === 'browser'`
  - has `tableId`, `uid`, `sl_cap`, `token`
  - **not** treated as public `web` solo
- `isTableHudSession` stays false for browser (HUD path unchanged).

---

## 8. Client UX flows

### A. From HUD (primary)

1. User in lobby/match (ideally after Join; host after Create).
2. Button: **Play match in browser** (lobby card and/or chrome; replace/clarify today’s solo-only chrome button when `room` present).
3. Call `mint_browser` → build URL → copy + `window.open` / SL browser dialog (reuse `openSeatedBrowser` patterns carefully — **must not** call `standalonePlayUrl`).
4. HUD navigates to **parked** state for MP (“Playing in browser — this HUD is parked”).
5. Browser: `claim_browser` → show table lobby UI → PeerJS connect to `room` → Ready / play.

### B. Host vs guest

- **Host:** always stays on HUD MoAP. **No** `mint_browser` for `uid == hostUid`. PeerJS host peer never moves.
- **Guest:** after claim, `joinPeerRoom(room)` (same as HUD Join peer step). If table Join already done on HUD, skip duplicate `tableJoin` or make Join idempotent.

### C. Failure messaging

If PeerJS still fails in external browser: show clear error + “network/VPN” tips; do not leave table Join stuck without Leave lobby (already improved).

---

## 9. PeerJS host (no handoff)

The **HUD that Create’d** owns PeerJS host peer id `canasta-{CODE}-host` for the whole lobby/match.

Because **the host must play in the HUD**, we do **not** destroy or migrate that peer for a browser session. Guests may leave MoAP PeerJS and reconnect from an external browser to the **same** host peer; the host MoAP connection stays up.

If a guest’s HUD had already joined PeerJS, parking the HUD should `destroy()` that guest peer before the browser joins (one peer per avatar).

---

## 10. Implementation plan (phased)

### Phase 0 — decisions (review)

**Resolved:** host HUD-only; guest browser mint after Join; one-time ~10 min token; stay seated.

### Phase 1 — Table mint/claim (LSL + API)

- `Canasta_Table.lsl`: token store, mint/claim, revoke hooks.
- `tableApi.ts`: `tableMintBrowser`, `tableClaimBrowser`.
- Status fields for browser-claimed seats.
- Unit/manual tests with Score Test–style or browser fetch against a table.

**Exit:** can mint/claim/reject expired tokens from curl/JSONP without full UI.

### Phase 2 — Browser session bootstrap (JS)

- `bootstrap.ts`: `token`; `isSeatedBrowserSession`.
- `App.tsx`: route seated-browser into `SlTableScreens` + PeerJS (not solo menu, not `isTableHudSession`).
- Fix `sessionUrl.ts` / chrome so MP mint ≠ solo `client=web`.
- Parked HUD copy for MP.

**Exit:** minted URL opens lobby UI and claims; fake peer optional.

### Phase 3 — Peer attach

- Guest browser: `joinPeerRoom` after claim (HUD peer destroyed on park).
- Host PeerJS stays on HUD — no handoff.
- Ready toggle / Leave lobby work from browser (already table-aware).

**Exit:** 2–4 humans, one **guest** on browser, complete a hand.

### Phase 4 — UX polish + docs

- Lobby button placement, errors, How to Play / `SECOND_LIFE.md` / `MULTIPLAYER.md`.
- Bump `asset-rev.txt`; table LSL recompile notes.
- Telemetry-lite: status string on failed Peer open (optional).

### Phase 5 — (optional later)

- Private PeerServer + TURN.
- Or table HTTP-IN move relay fallback.

---

## 11. File touch list (expected)

| Area | Files |
|------|--------|
| LSL | `Canasta_Table.lsl` (+ maybe Http forward already generic) |
| API | `src/sl/tableApi.ts` |
| Bootstrap / URL | `src/sl/bootstrap.ts`, `sessionUrl.ts`, tests |
| App / UI | `App.tsx`, `SlTableScreens.tsx`, `AppChrome.tsx`, `ParkedHud.tsx` |
| Docs | `SECOND_LIFE.md`, `MULTIPLAYER.md`, this design |
| Deploy | `public/asset-rev.txt` |

No Experience DB required for v1 (tokens live on the **table object**).

---

## 12. Decisions

| ID | Question | Decision |
|----|----------|----------|
| **A** | When can you mint? | **After table Join** (host has Create; guests mint only once Joined) |
| **B** | Token lifetime? | **10 min, one-time claim**; remint from HUD anytime while still Joined |
| **C** | Host in browser? | **No — host must play in the HUD.** Only **guests** get minted browser URLs. Avoids PeerJS host handoff. |
| **D** | Solo vs match browser buttons? | **Separate actions** (solo `client=web` stays as today; match mint is different) |
| **E** | Must remain seated? | **Yes** for v1 (stand / leave / lobby dissolve revokes token) |

### Locked product rule

**The multiplayer host always uses the in-world HUD MoAP.** Browser play is a **guest fallback** for PeerJS/MoAP problems (or preference), not a host path.
---

## 13. Effort estimate (rough)

| Phase | Order of magnitude |
|-------|--------------------|
| Phase 1 table mint/claim | ~0.5–1 day |
| Phase 2 JS session routing | ~0.5–1 day |
| Phase 3 Peer (guest browser → HUD host) | ~0.5 day |
| Phase 4 polish/docs | ~0.5 day |

**Guest browser + host-on-HUD v1:** about **2–3 focused days** including in-world soak.

---

## 14. Success criteria

1. Flaky-MoAP user: sit → Join on HUD → mint → open browser → appears on others’ PeerJS list → Ready → host Start → play a deal.
2. Random person with room code but no token: cannot claim.
3. Stand while browser open: claim/peer rejected or match forfeits cleanly.
4. Solo public web unchanged.
5. Existing HUD-only MP path unchanged when no one mints.

---

## 15. Recommendation

Ship **guest seated browser MP** with **one-time table-minted tokens**, mint **after Join**, park guest HUD, reuse PeerJS room hosted by the **HUD host**. **Host never leaves MoAP for MP.** Keep TURN/table-relay as separate reliability track.
