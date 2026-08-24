# Samba — Rules reference

Samba is a three-deck Canasta variant that adds **sequence melds** (sambas) alongside the usual **group melds** (canastas). This document follows [Pagat Samba](https://www.pagat.com/rummy/samba.html) (Dutch / standard rules). Use it as the target ruleset for a future in-game variant.

Our engine today supports **rank-only melds** (Classic Canasta and Hand & Foot). Samba is the first variant that requires **runs in suit**.

---

## Players and teams

| Players | Mode |
|--------|------|
| 2, 3, or 5 | Each player for themselves |
| 4 or 6 | Fixed partnerships (partners sit opposite) |

**Our game:** We support **2** (heads-up) and **4** (partners). Four-player Samba matches Pagat partnership play. Two-player Samba is cutthroat (each player is their own team), same seating model as Classic Canasta.

---

## Cards and deck

- **162 cards:** three standard 52-card decks plus **6 jokers**.
- **Card values** (for meld totals and deadwood):

| Card | Points |
|------|--------|
| Ace | 20 |
| K, Q, J, 10, 9, 8 | 10 |
| 7, 6, 5, 4 | 5 |
| Black 3 | 5 |
| 2 (wild) | 20 |
| Joker (wild) | 50 |
| Red 3 | See [Red threes](#red-threes) |

Twos and jokers are wild. Fours through aces are natural. Threes have special rules.

---

## Deal

- **15 cards** each when 2–5 players; **13 cards** each with 6 players.
- For our **4-player** table: **15 cards** each (Pagat).
- For our **2-player** table: **15 cards** each (Pagat).
- Turn one card face up to start the discard pile; remainder is stock.

There is **no “frozen pile” flag** as in Classic Canasta. The discard pile is always taken under Samba’s stricter pickup rules (see [Discard pile](#discard-pile)).

---

## Turn structure

Each turn:

1. **Draw two** cards from stock, **or** take from the discard pile when legal (see below).
2. **Meld** optionally (any number of melds).
3. **Discard one** card — unless going out by melding every card (see [Going out](#going-out)).

Drawing two and discarding one means hands **grow over time**, unlike Classic Canasta (draw one).

---

## Meld types

### Groups and canastas

A **group** is three or more cards of the **same rank** (e.g. three kings, five eights).

**Wild rules for groups:**

- At least **twice as many naturals as wilds** (minimum **2 naturals** in a 3-card meld with 1 wild).
- At most **2 wilds** per group (stricter than Classic’s 3).

A **canasta** is a group of **seven or more** cards.

- **Pure canasta:** no wilds — stack with a red indicator; **+500** bonus.
- **Mixed canasta:** includes wilds (max 2 wilds) — black indicator; **+300** bonus.
- Canastas **may exceed seven** cards.
- Adding a wild to a **pure** canasta **downgrades** it to mixed.

**Multiple groups of the same rank** may exist as **separate melds** (unlike Classic, where only one open meld per rank is allowed). You may **merge two same-rank groups** into one canasta on your turn.

**Black threes in groups:** May be melded **only on the turn you go out**, following normal group rules (no wilds).

### Sequences and sambas

A **sequence** is three to seven **natural** cards of the **same suit** in **consecutive rank**.

- **No wilds** and **no threes** in sequences.
- Ace is **high only** (above king). Valid run: 8-9-10-J-Q-K-A. **4 is low** (no ace below 4).
- A complete sequence of **seven** cards is a **samba**. **No further cards** may be added to a samba.
- **Samba bonus:** **+1500** each.

Only **five** sambas are possible per suit (fixed 7-card windows):

| Samba | Ranks |
|-------|-------|
| 1 | 4-5-6-7-8-9-10 |
| 2 | 5-6-7-8-9-10-J |
| 3 | 6-7-8-9-10-J-Q |
| 4 | 7-8-9-10-J-Q-K |
| 5 | 8-9-10-J-Q-K-A |

**Important:** Two partial sequences already on the table **cannot** be merged into a samba by melding a connecting card. Each sequence meld stands alone until completed in one line.

---

## Red threes

- May be melded **singly** for a bonus (optional — you do not have to meld them immediately from hand).
- **+100** each when your team has met the **going-out requirement** (two sambas, two canastas, or one of each).
- **All six** red threes melded (partnership combined in 4p): **+1000** instead of 600.
- If melded but the team **does not** have the required sambas/canastas at end of hand: **−100** per melded red three.
- **Red threes in hand** at end of hand: **−750** total (regardless of count).
- Discarding a red three **blocks** the next player from taking the pile (same as wild or black three).

Samba red-three scoring differs from Classic (no auto-lay on draw; stricter end penalties).

---

## Black threes

- **Discard:** blocks the next player from taking the pile.
- **Meld:** only on the **go-out turn**, in a group (3+ black threes, no wilds), same as Samba’s group rules.

---

## Initial meld

First meld of the hand for a team must meet a **minimum point total** from cards melded (bonuses and red threes do **not** count).

| Team score at start of hand | Minimum |
|----------------------------|---------|
| Negative | 15 |
| 0 – 1,495 | 50 |
| 1,500 – 2,995 | 90 |
| 3,000 – 6,995 | 120 |
| 7,000+ | 150 |

This table is **higher** than Classic Canasta at high scores (Classic tops at 120 from 3,000+).

---

## Discard pile

### Take entire pile (group pickup)

If you hold **two natural cards** matching the **rank** of the top discard:

1. Take the top card.
2. Meld it with your two naturals.
3. If this is the team’s first meld, meld enough additional cards from hand to meet the **initial minimum**.
4. Take the **rest** of the discard pile.
5. Meld further if desired.
6. Discard one.

You **cannot** take the pile to add the top card to an **existing group** unless you also produce two naturals of that rank from hand (same as “always frozen for rank pickup”).

### Take one card (sequence extension)

If the team already has an **open sequence** of fewer than seven cards, and the top discard **fits on one end** of that sequence (same suit, consecutive rank):

- You may take **only that top card** (instead of drawing two from stock) and add it to the sequence.

You **cannot** take the discard to **start** a new sequence — only to extend an existing one.

### Blocked top cards

Cannot take the pile (or its top card for sequences) when the top is a **red three**, **black three**, **two**, or **joker**. Discarding any of these blocks the next player.

---

## Going out

To go out, your team must already have:

- **Two sambas**, or
- **Two canastas** (pure or mixed), or
- **One samba and one canasta**

You may go out by melding all cards or by melding all but one and **discarding** the last card.

**Partner consent:** You may ask “Partner, may I go out?”; partner answers yes or no. You may also go out **without** asking.

If you **cannot** legally go out but would meld down to one card, you must **not** discard — end the turn by **passing** and keep that card (only situation where pass replaces discard).

**Going-out bonus:** **+200** to the team that goes out.

---

## Scoring a hand

Each team scores:

- **Plus** value of all melded cards.
- **Minus** value of cards left in hand.
- **Plus** bonuses:
  - Samba: +1500 each
  - Pure canasta: +500 each
  - Mixed canasta: +300 each
  - Going out: +200
  - Red three bonuses / penalties as above

**Match goal:** **10,000** points. First team to reach or exceed 10,000 at end of a hand wins. Tie at threshold: higher total wins.

---

## Stock exhaustion

If the stock is empty and a player needs to draw, play continues until someone attempts to draw from an empty stock — then the hand ends **without** a going-out bonus (same spirit as Classic).

When one card remains in stock, the next drawer takes **one** card instead of two, then melds and discards normally.

---

## Differences from Classic Canasta (summary)

| Topic | Classic | Samba |
|-------|---------|-------|
| Decks | 2 (+ 4 jokers) | 3 (+ 6 jokers) |
| Hand size (4p) | 11 | 15 |
| Draw per turn | 1 | 2 |
| Meld types | Groups only | Groups + sequences |
| Wilds per group | Up to 3 | Up to 2 |
| Same rank on table | One open meld | Multiple groups OK |
| Canasta size | 7+, may grow | 7+, may grow |
| Sequence melds | No | Yes (3–7, samba at 7) |
| Go out | ≥1 canasta | 2× samba and/or canasta combo |
| Play to | 5,000 | 10,000 |
| Red threes | Auto-lay, Classic scoring | Optional meld, stricter penalties |
| Pile “freeze” | Yes (wild/red upcard) | No separate freeze; strict pickup rules |
| Initial meld max | 120 (3k+) | 150 (7k+) |

---

## Sources

- [Pagat — Samba](https://www.pagat.com/rummy/samba.html) (primary)
- [Rummy-Games.com — Samba](https://www.rummy-games.com/rules/samba.html) (secondary)
