# Classic Ichi — v1

`family=ichi`, variant `classic`. Free-for-all shedding game.

## Deck (108)

Four colors: **R**ed, **Y**ellow, **G**reen, **B**lue.

Per color: one **0**, two each of **1–9**, two **Skip**, two **Reverse**, two **Draw Two**.  
Plus four **Wild** and four **Wild Draw Four**.

## Deal & play

- **2–4** players; deal **7** each. Top of remaining stock is the starting discard (reshuffle if action card needs a color — turn until a number shows, or apply Wild with a named color).
- On your turn play one card that matches the **current color** or the **rank/action** of the top discard. **Wild** is always legal. **Wild Draw Four** is legal only when you have no card of the current color (action cards of that color still block WDF).
- If you cannot play, draw one from stock. If that card is playable you may play it immediately; otherwise your turn ends.
- Empty stock: shuffle the discard (keep top card) into a new stock.

## Action cards

| Card | Effect |
|------|--------|
| **Skip** | Next player is skipped |
| **Reverse** | Direction flips; with **2 players** acts as Skip |
| **Draw Two** | Next player draws 2 and is skipped (**no stacking** in v1) |
| **Wild** | Choose the next color |
| **Wild Draw Four** | Choose color; next draws 4 and is skipped. May be **challenged** |

## Wild Draw Four challenge

After a WDF is played (before color is locked in / next acts), the next player may **challenge**:

- If the player who played WDF **had** a card of the previous color → they draw **4** instead, and play continues as if the WDF failed (challenger does not draw).
- If the play was legal → challenger draws **6** (4 + 2 penalty) and is skipped.

## Ichi

When you play down to **one** card you must **call Ichi**.  
If you fail and are caught before the next player’s play resolves → draw **2**.  
Bots always call; humans use the Call Ichi control (missed call is catchable).

## Scoring (to 500)

Player who goes out scores the sum of cards left in opponents’ hands:

- Number cards: face value (0–9)
- Skip / Reverse / Draw Two: **20**
- Wild / Wild Draw Four: **50**

First to **500** (highest) wins. Ties at/over target → play another hand.
