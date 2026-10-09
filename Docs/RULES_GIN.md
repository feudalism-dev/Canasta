# Gin Rummy (table rules)

Two-player variant behind `family=rummy`. Select **Gin Rummy** on the HUD before Solo / Create.

## Deal

- One 52-card deck (no jokers).
- 10 cards each; one upcard starts the discard pile.
- First player (seat 0 / non-dealer in solo) draws first.

## Turn

1. Draw from stock **or** take the top discard.
2. Either **discard** one card (turn ends) or **knock** (ends the hand).

Melds stay in your hand until a knock. There is no mid-hand table meld.

## Knocking

After drawing, select the card you will discard and press **Knock** when the rest of your hand has **10 or fewer** deadwood points (best arrangement of sets and runs).

- **Deadwood:** face cards and 10s = 10; Aces = 1; pip cards = face value.
- **Gin:** 0 deadwood after the knock discard. Opponent may **not** lay off.
- **Ordinary knock:** opponent may lay unmatched cards onto your exposed melds, then scores their remaining deadwood after their own best melds.

## Scoring (hand)

| Result | Points |
|--------|--------|
| Knock succeeds (opp deadwood &gt; yours) | Difference in deadwood |
| Gin | Opponent deadwood + **25** |
| Undercut (opp ≤ your deadwood after layoffs) | Opponent scores the difference + **25** |

## Match

- First player to **100** points wins (**highest** score).
- Stock: the last **two** cards may not be drawn. Tapping Stock when closed (or discarding with ≤2 left) ends the hand with **no score**.

## vs Standard Rummy

| | Standard | Gin |
|--|----------|-----|
| Players | 2–4 | 2 only |
| Hand size | 7 | 10 |
| Melds | On table mid-hand | In hand until knock |
| End hand | Empty hand | Knock / gin / stock closed |
| Match | Lowest to 100 | Highest to 100 |
