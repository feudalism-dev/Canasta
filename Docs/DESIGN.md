# Hand & Foot / Canasta — Design

Art Deco card parlor. Emerald felt, brass rails, warm lamp light. Custom basket-motif card backs (*canasta* = basket). 1950s boom-era glamour — not a Bicycle clone.

**Runtime:** React + Vite + TypeScript in the browser (CEF 139+ / Chromium).  
**Host:** GitHub Pages.  
**Multiplayer:** PeerJS P2P, host-authoritative.  
**Second Life:** AVsitter HUD + table HTTP-IN lobby (`Docs/SECOND_LIFE.md`).  
**Storefront:** Second Life (paid); Experience DB entitlement deferred.

## Product

Canasta-family parlor (Classic, Hand & Foot, Samba, Bolivia) plus a sister **Rummy** product SKU. Same HUD, same Pages app; table LSL sets `family` (`canasta` | `rummy`) as a creator lock. Hearts/Rook are a future **trick** family — not Rummy.

Canasta: menu pick Classic / Hand & Foot / …. Partnership is first-class (seats 0+2 vs 1+3). Solo default is you + AI partner vs two AI. Table multiplayer always deals four hands; seating is how you pick versus vs co-op.

The HUD teaches itself: rank-grouped hand, legal glow, coach bar, take-pile preview, live initial-meld meter, “May I go out?” consent.

## Why it is easy

Physical Canasta players sort by rank. The HUD does that automatically. Tap a rank group and the meld builder offers only legal actions. Red threes fly to the bonus tray. Completing a canasta snaps into a red or black book.

## Table (v1 vs later)

v1 seated play **claims** the table (one game at a time) and drives the HUD. In-world spectator display (Furware + table-top MOAP) is specified in `Docs/TABLE_DISPLAY.md`.
