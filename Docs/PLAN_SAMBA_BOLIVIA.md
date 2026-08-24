# Plan — Samba and Bolivia variants

Research docs: [RULES_SAMBA.md](./RULES_SAMBA.md), [RULES_BOLIVIA.md](./RULES_BOLIVIA.md).

**Status:** Samba beta playable (sequences, draw-2, go-out, scoring). Bolivia uses same engine with wild Bolivia books and stricter go-out. **No table or scoreboard LSL changes** — existing shipped scripts unchanged; Samba/Bolivia match scores may appear on the Canasta scoreboard tab until an optional future scoreboard/table script update.

**Beta policy:** Samba and Bolivia appear in setup/lobby with a **Beta** label and notice. Classic Canasta and Hand & Foot are unchanged and not beta. Beta variants may change rules, scoring, or UI without a version bump; player feedback drives fixes before they graduate to full support.

**Goal:** Add **Samba** and **Bolivia** to the game-selection dropdown alongside Classic Canasta, Pagat Hand & Foot, and House Rules Hand & Foot. Fixed rulesets (like Pagat H&F), not a new house-rules editor.

**Constraint:** Classic Canasta and both Hand & Foot modes are **live and sold**. New variants must ship without changing their rules, scoring, UI, networking, or scoreboard behavior.

---

## Production safety (non-negotiable)

The product is already on sale. Treat Samba/Bolivia as an **additive product line**, not a rewrite of the shared engine.

### Principles

1. **No behavior change for existing variants.** Selecting Classic / Pagat H&F / House Rules H&F must produce the same deal, draws, pile rules, melds, go-out, and scores as today. New flags default so Classic/H&F paths are unchanged.
2. **Branch on `variant` / config flags**, do not “fix” Classic/H&F to look more like Samba. Prefer `if (config.sequencesEnabled)` / `if (variant === 'samba')` over rewriting shared functions’ defaults.
3. **Additive types.** Prefer optional fields with defaults over breaking unions. Example: keep today’s group melds as `{ rank, cards, closed }` and add `kind?: 'group' | 'sequence'` (default `'group'` when missing) plus sequence-only fields. Existing Classic/H&F code that ignores `kind` keeps working.
4. **Regression gate before every merge.** Full `npm test` must pass. Expand Classic and H&F coverage (golden-path: deal, take pile, initial meld, go out, score) so Samba refactors cannot silently change them.
5. **Ship as beta in the dropdown.** Samba and Bolivia are selectable with **Beta** labeling and an in-HUD notice so testers can report bugs. Classic / H&F behavior stays production-stable.
6. **LSL last and additive.** Do not recompile table/HUD/scoreboard scripts until web `GAME_OVER` letters and scoreboard tabs are ready. New codes `s`/`b` must **accept** without breaking `c`/`h` parsing. Never reuse or redefine existing Experience keys.
7. **Small, reviewable phases.** One PR family per phase in the table below. Prefer “sequences exist but unused” before “Samba is selectable.” Avoid large all-in-one PRs that touch melds + pile + score + UI + LSL together.
8. **Peer / lobby compatibility.** Older HUDs must ignore unknown `variant` strings safely (fall back or refuse join with a clear message). Do not change the meaning of existing lobby fields (`house`, `c`/`h` scores).
9. **Manual smoke after each ship.** Quick Classic 2p and Pagat H&F 4p (or solo) smoke on HUD + table MoAP after any core meld/rules change, even if unit tests pass.

### Safer meld model (preferred over a hard union)

Avoid forcing every call site to handle a tagged union on day one:

```ts
// Prefer additive (backward compatible)
type Meld = {
  rank: MeldRank        // keep for groups; e.g. sentinel or unused for sequences
  cards: Card[]
  closed: boolean
  kind?: 'group' | 'sequence'  // omit / 'group' = Classic & H&F today
  suit?: Suit                  // sequences only
}
```

Sequence logic runs only when `config.sequencesEnabled` is true. Classic/H&F never set `kind: 'sequence'`.

### What not to do

- Do not change Classic wild caps, freeze rules, initial-meld table, or go-out (+100 / concealed) as a side effect of Samba work.
- Do not change H&F foot pickup, book close-at-seven, or house-rule encoding.
- Do not bump LSL `PAGE_ASSET_REV` / force recompile for web-only Samba UI; use `public/asset-rev.txt` as today.
- Do not force-push or land untested core changes on `main` without the regression gate.

---

## Product placement

### Dropdown labels (proposed)

| `Variant` value | UI label |
|-----------------|----------|
| `canasta` | Classic Canasta — to 5,000 |
| `handAndFoot` | Pagat Hand & Foot — 4 rounds |
| `handAndFootHouse` | House Rules Hand & Foot — 4 rounds |
| `samba` | Samba (Beta) — to 10,000 |
| `bolivia` | Bolivia (Beta) — to 15,000 |

Touch points (same pattern as existing variants):

- `src/App.tsx` — solo setup `<select>`
- `src/ui/SlTableScreens.tsx` — table lobby `<select>`
- `src/net/peerSession.ts` — lobby `variant` broadcast (type only; no schema change)
- `Docs/RULES.md` — short pointer to Samba/Bolivia docs
- `Docs/NOTECARD_*.txt` — mention new modes when implemented

House-rules UI (`HouseFields.tsx`) stays **hidden** for Samba/Bolivia (same as Classic).

---

## Engine gap analysis

Today’s meld model is **rank-only**:

```64:68:src/core/types.ts
export type Meld = {
  rank: MeldRank
  cards: Card[]
  closed: boolean
}
```

Samba/Bolivia need **two meld kinds**:

1. **Group** — same as today (`rank` + cards).
2. **Sequence** — same **suit**, consecutive **ranks**, 3–7 cards, no wilds; identity is not a single `MeldRank`.

### Recommended data model change

Prefer the **additive** meld shape in [Production safety](#production-safety-non-negotiable) over a hard tagged union that rewrites every Classic/H&F call site.

- `kind` omitted or `'group'` → today’s behavior.
- `kind: 'sequence'` → only when `sequencesEnabled` (Samba/Bolivia).
- Bolivia wild books reuse existing `rank: 'WILD'` group path (already used by H&F wild books); enable via Bolivia config, not by changing H&F defaults.

**Files most affected:**

| Area | Files | Work |
|------|-------|------|
| Types | `types.ts`, `cards.ts` | Meld union, variant enum, `VariantConfig` flags |
| Variants | `variants.ts`, new `sambaRules.ts` or flags on config | Deck 3, hand 15, draw 2, play-to, wild caps |
| Melds | `melds.ts` | Validate groups vs sequences; sort/display; infer rank/suit |
| Rules | `rules.ts` | Pile take (1-card sequence vs full pile), multi-meld same rank, pass turn, go-out |
| Score | `score.ts` | Samba +1500, Bolivia +2500, red-three Samba logic, go-out 200 |
| State | `state.ts` | Deal 162 cards; no foot |
| UI | `GameBoard.tsx`, meld builder, `AppChrome.tsx` | Sequence selection, samba/canasta/bolivia badges |
| AI | `ai*.ts` if present | Sequence heuristics |
| Tests | `rules.test.ts`, `melds.test.ts`, new `samba.test.ts` | Coverage for pile, go-out, scoring |
| Table MoAP | table bundle | Render sequences in suit order |
| Scoreboard | `Canasta_Scores.lsl`, scoreboard page, `SCOREBOARD.md` | Game codes `s` / `b` |
| LSL HUD | `Canasta_Http.lsl` `GAME_OVER` pipe | Emit variant letter |

---

## VariantConfig additions (proposed)

Extend `VariantConfig` with Samba/Bolivia-specific flags instead of overloading `house`:

| Flag | Samba | Bolivia | Classic |
|------|-------|---------|---------|
| `deckCount` | 3 | 3 | 2 |
| `handSize` (4p / 2p) | 15 / 15 | 15 / 15 | 11 / 15 |
| `stockDraw` | 2 | 2 | 1 |
| `playTo` | 10000 | 15000 | 5000 |
| `maxWildsPerMeld` | 2 | 7 (wild book) | 3 |
| `allowMultipleGroupsSameRank` | true | true | false |
| `sequencesEnabled` | true | true | false |
| `canastaMayExceed` | true | true | true |
| `booksCloseAtSeven` | false (groups); true (sequences) | same | H&F only |
| `freezeOnWildDiscard` | false | false | true |
| `takePileNeedsTwoNaturalsAlways` | true | true | false |
| `blockTakePileOnWildTop` | true | true | partial |
| `wildBooksAllowed` | false | true | false |
| `goingOutRule` | `samba` | `bolivia` | `canasta` |
| `redThreeMode` | `samba` | `samba` | `classic` |
| `concealedBonus` | false | false | true |
| `requireDiscardToGoOut` | true | true | false |
| `partnerConsent` | optional | optional | false |

Implement `goingOutRule` as a small validator:

- **canasta:** ≥1 seven-card group (current).
- **samba:** count(sambas) ≥ 2 OR count(canastas) ≥ 2 OR (sambas ≥ 1 AND canastas ≥ 1).
- **bolivia:** count(seven-card melds) ≥ 2 AND count(sambas) ≥ 1.

---

## Rule modules to implement

### Phase 1 — Samba foundation

1. **Three-deck shoe** — 162 cards in `state.ts` / deal logic (reuse multi-deck path from H&F).
2. **Draw two** — already parameterized via `stockDraw`; wire turn flow and “last card in stock” (draw 1).
3. **Sequence melds** — create, extend, validate, close at 7.
4. **Group rule deltas** — max 2 wilds; allow duplicate ranks; merge same-rank groups on one turn.
5. **Discard pile**
   - Rank pickup: two naturals + top; optional initial-meld completion; take rest of pile.
   - Sequence pickup: single top card onto existing open sequence only.
   - Block on wild / red 3 / black 3 top.
   - No “add top to existing group without two naturals.”
6. **Initial meld** — Samba table including 150 at 7000+.
7. **Red threes** — optional meld; bonus only if go-out requirements met; penalties; no auto-replace from stock unless we choose QoL autoplay (Pagat: optional — **manual meld** is correct).
8. **Black threes** — go-out turn only in groups.
9. **Pass instead of discard** when one card left and cannot go out.
10. **Scoring** — samba 1500, go-out 200, Samba red-three matrix.
11. **UI** — meld builder: toggle group vs sequence; suit+run preview; table columns for sequences.

### Phase 2 — Bolivia delta

1. **Wild melds** — 3+ wild group; seven = Bolivia, closed, +2500.
2. **Relax group wild cap** — remove Samba 2-wild / 2× natural constraint for Bolivia groups (keep sensible minimum meld size 3).
3. **Going out** — two seven-card melds including ≥1 samba.
4. **Play to 15,000**.
5. **Wild top blocks pile** — enforce even if other pickup might seem legal.

Optional later: house toggle for “melded black threes during play / −100 deadwood.”

---

## UI / UX notes

- **Meld builder:** Selecting 3+ consecutive same-suit naturals should offer “Meld as sequence” vs splitting if also same rank (rare collision).
- **Display:** Sequences shown in rank order with suit icon; completed samba badge (+1500). Groups unchanged.
- **Multiple aces groups:** Allow second meld same rank (Samba/Bolivia only).
- **Partner consent:** Reuse H&F dialog when `partnerConsent` true (Samba/Bolivia: optional ask per Pagat).
- **HUD books toggles:** Unchanged — hide/show our/opp melds; sequences included in “books.”
- **Table spectator board:** Must render sequence melds (new row layout or inline run).

---

## Scoreboard and LSL

Today: `c` = Canasta, `h` = Hand & Foot (`Docs/SCOREBOARD.md`).

Proposed:

| Variant | `GAME_OVER` code | Experience keys |
|---------|------------------|-----------------|
| Samba | `s` | `cn.sc.s.*` |
| Bolivia | `b` | `cn.sc.b.*` |

Changes:

- HUD / table emit correct letter on match end.
- `Canasta_Scores.lsl` accept `s` and `b`.
- Scoreboard web app: two new tabs or grouped “Samba / Bolivia” under a third game family.
- Separate leaderboards (scores not comparable to Classic or H&F).

No `asset-rev` bump until web UI ships; no LSL recompile until `GAME_OVER` format is used.

---

## Testing strategy

**Regression (must stay green — live product):**

- Existing `rules.test.ts`, `houseRules.test.ts`, and related Classic / H&F tests must not be weakened or deleted to make Samba pass.
- Add explicit golden-path tests if gaps appear while touching shared code: Classic take-pile / freeze / go-out; Pagat H&F foot + books; House Rules encode/decode.
- Run `npm test` before every merge that touches `src/core/`.

**Unit tests (new — Samba/Bolivia):**

- Sequence validation (ace high, 4 low, no wilds).
- Only five sambas per suit — cannot extend past 7 or merge two 3-stacks.
- Pile: sequence extension vs illegal new sequence from discard.
- Go-out matrix for Samba and Bolivia.
- Red-three bonus vs penalty without required melds.
- Score snapshots: samba + canasta + mixed bonuses.
- Assert Classic/H&F configs still have `sequencesEnabled: false` and unchanged wild/go-out flags.

**Manual / table QA:**

- After any core PR: smoke Classic + one H&F mode (solo or table).
- When Samba is selectable: 4p partnership Samba to 10k; MoAP sequences.
- When Bolivia ships: wild book + samba go-out; scoreboard `s`/`b` without breaking `c`/`h`.

---

## Phased rollout

| Phase | Deliverable | Risk to live game | Gate |
|-------|-------------|-------------------|------|
| **0** | Docs (this file + rules) | None | — |
| **1a** | Additive meld fields + sequence validators + tests; **UI still hidden** | Medium (shared types) | Classic/H&F regression green |
| **1b** | Samba `variantConfig` only; no lobby option yet | Low | Config snapshot tests |
| **1c** | Pile / go-out / score behind `sequencesEnabled` / `goingOutRule` | High | Branch coverage + Classic smoke |
| **1d** | Sequence UI (builder/display); Samba still gated | Medium | Classic/H&F UI unchanged |
| **1e** | Un-gate **Samba** in dropdown; AI or “computers limited” note | Product risk | Full Samba playtest |
| **2a** | Bolivia config + wild Bolivia + go-out | Low if Samba solid | Samba + Classic/H&F green |
| **2b** | Scoreboard + LSL `s`/`b` (additive parsers) | Low if additive | Verify `c`/`h` still record |
| **2c** | Notecards + RULES.md | None | — |

**Recommendation:** Land engine support with the variant **hidden**, prove Classic/H&F untouched, then expose Samba. Ship Bolivia only after Samba is stable in production.

---

## Out of scope (initial release)

- House-rules editor for Samba/Bolivia
- 3-, 5-, or 6-player cutthroat Samba
- Sambola, Black Samba, Trey, Quad, Royal Canasta
- Black-threes-meld-during-play Bolivia variant (unless added as one toggle later)

---

## Open decisions (for you)

1. **Red threes in UI:** Strict Pagat (player melds manually from hand) vs QoL auto-lay on draw like Classic?
2. **Bolivia black threes:** Pagat go-out-only (−5 deadwood) vs common −100 meld variant?
3. **Scoreboard tabs:** Two new top-level tabs vs one “Samba family” tab with sub-filter?
4. **AI difficulty:** Ship Samba with existing AI stub / simplified bot, or block solo until AI understands sequences?

---

## References

- [RULES_SAMBA.md](./RULES_SAMBA.md)
- [RULES_BOLIVIA.md](./RULES_BOLIVIA.md)
- [Pagat Samba](https://www.pagat.com/rummy/samba.html)
- Current engine: [RULES.md](./RULES.md), `src/core/melds.ts`, `src/core/variants.ts`
