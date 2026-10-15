# Row! Sham! Bo! — Classic rules

## Goal

Score the most points over a full deck, then race to a **match target** (default 100; options 200–500).

## Deck (Classic)

52 cards: 16 Rock, 16 Paper, 16 Scissors, 4 Dynamite.

## Hierarchy

Rock beats Scissors · Scissors beats Paper · Paper beats Rock · Dynamite beats Rock/Paper/Scissors. Same vs same (including Dynamite×Dynamite) = tie.

## Game setup (once per game)

1. Deal **5** cards each.
2. **Randomizer** picks Clockwise or Counter-clockwise for **turn 1** (pass direction and that round’s fight order).
3. **Pass once** — each player passes 1 card in that direction (60s timeout → random card). No further passing until the next game.

## Round flow (repeat until the deck and hands are empty)

1. **Randomizer** (every round after turn 1) picks a new fight direction — who you duel around the table.
2. **Draw** up to 5 cards (skip when stock empty).
3. **Play** one card face-down (60s timeout → random).
4. **Reveal** and **resolve** from the button seat, walking that round’s direction:
   - Contested starts as the button player.
   - Tie → join the contested group.
   - Lose to the group → each contested player scores +1.
   - Beat the group → score +size of group and become the new contested player.
5. Button rotates clockwise each round.

## Endings

- **Game:** stock empty and all hands empty → highest game score wins the game (points add to match totals). Next game includes one new pass and a fresh turn-1 direction.
- **Match:** first to reach/exceed the match target; if several crossed, highest wins; still tied → match tie.

## Future: Elements

64-card deck adds 4 Water, 4 Earth, 4 Fire. Water beats Rock/Paper/Earth; Earth beats Rock/Scissors/Fire; Fire beats Paper/Scissors/Water. Dynamite still beats all.

## Art assets

Drop files under `public/assets/`:

| File | Size / notes |
|------|----------------|
| `rowshambo_ad.jpg` | Hub picker ad (~1024×1024 comic poster, no transparency) |
| `rowshambo/rock.png` | Transparent PNG card art |
| `rowshambo/paper.png` | Transparent PNG |
| `rowshambo/scissors.png` | Transparent PNG |
| `rowshambo/dynamite.png` | Transparent PNG |
| `rowshambo/water.png` | (Elements later) |
| `rowshambo/earth.png` | (Elements later) |
| `rowshambo/fire.png` | (Elements later) |
| `rowshambo/burst-pow.png` | Optional comic stamp |
| `rowshambo/burst-oof.png` | Optional |
| `rowshambo/burst-tie.png` | Optional |

Until card PNGs exist, the UI uses bold color faces + glyphs.
