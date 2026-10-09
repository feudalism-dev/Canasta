# Rummy variants (beyond Standard / Gin)

Selectable in the Rummy lobby game dropdown. Engine: `src/core/rummy/`.

## Oklahoma Gin

- Same flow as Gin (2 players, melds stay in hand until knock).
- First upcard sets the knock limit: Ace → gin only (0); 2–9 → that number; 10 / face → 10.
- Spade upcard doubles all scores for that hand.
- Play to **150** (highest wins). Gin / undercut bonuses same as Gin (25).

## Rummy 500

- 2 players: 13 cards; 3–4 players: 7 cards. Ace = 15.
- Table melds and layoffs during the turn.
- **Deep discard:** tap any card in the discard fan; take that card and every card above it. You **must** meld or lay off the buried (chosen) card before discarding.
- **Meld scoring:** at hand end, each player scores points in their melds (and layoffs they made onto others) minus deadwood left in hand. First to **500** (highest) wins.
- Stock empty: score the table (no reshuffle).

## Kalooki (open) — v1

Simplified open game (not full Jamaican contract Kalooki yet):

- 2 decks + 4 jokers; deal 13; **9 hands** then lowest score wins.
- Jokers are wild in sets/runs (≥2 naturals in a set). **Cannot discard a joker.**
- Black ace = 15, red ace = 1, joker = 50 in hand penalties.
- Table melds / layoffs like Standard; go out by emptying the hand; opponents take deadwood.

Contract / buy / special sequences can come later without changing the SKU.
