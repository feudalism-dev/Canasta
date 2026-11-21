# BATTLE FLEET
## Game Design & Functional Specification
### Second Life – Parlor Table Game Collection

**Document Type:** Game Design and Functional Requirements  
**Game Family:** `battlefleet`  
**Platform:** Second Life  
**Interfaces:** Player HUD (Media-on-a-Prim) and Tabletop Display (Media-on-a-Prim)  
**Players:** 1–4 human/computer participants  
**Game Type:** Multiplayer naval strategy game

---

# PART 1 – PROJECT OBJECTIVE AND EXISTING ARCHITECTURE

## 1.1 Project Objective

Extend the existing Parlor table game collection to include a naval combat strategy game inspired by Battleship.

Battle Fleet must support:

- One human player against one, two, or three computer opponents.
- Two human players competing head-to-head.
- Three-player free-for-all games.
- Four-player free-for-all games.
- Four-player team games (2 vs. 2).
- Mixed human/computer configurations where supported by the existing session architecture.

Players position fleets on a shared battlefield, then take turns attacking opposing territories.

Each player interacts through their own Media-on-a-Prim HUD. A shared tabletop Media-on-a-Prim display shows the public battlefield, hits, misses, sunk ships, scores, player information, and game progress.

The objective is to destroy the entire opposing fleet.

## 1.2 Critical Requirement: Preserve the Existing Parlor Architecture

The supplied LSL files establish the existing Parlor infrastructure.

The new game must be implemented as an additional game family within this system, not as a replacement or independent table system.

The following existing scripts must be treated as working shared infrastructure:

| Existing script | Existing responsibility |
|---|---|
| `Parlor_Table.lsl` | Table controller, four physical seats, player roster, HUD rezzing, solo sessions, multiplayer lobby, room codes, player departure, reconnect/grace handling |
| `Parlor_Http.lsl` | HTTP interface, browser communication, status JSON, game-family selection, Experience entitlement checks, board-data transport |
| `Parlor_Display.lsl` | Tabletop MoAP loading, player information, Furware text displays, scores, turn indicators, game display events |
| `Parlor_Register.lsl` | Game-family registration through the Second Life Experience system |
| `Parlor_Scores.lsl` | Final score reporting to the external scoreboard |

### Mandatory Development Rules

1. Do not rewrite working Parlor infrastructure.
2. Do not replace the existing table controller or HTTP system with a new implementation.
3. Do not introduce a separate seating, HUD-rezzing, lobby, or room-code system.
4. Reuse the existing table session and player identity mechanisms.
5. Keep Battle Fleet game-specific logic isolated from existing card games.
6. Do not change the behavior of existing game families.
7. If changes to shared scripts are necessary, keep them minimal, backward-compatible, and justified by a specific requirement.
8. Do not assume that a feature exists simply because the LSL infrastructure supports communication with a browser.
9. Inspect the existing game HUDs and web applications to understand their actual communication conventions before implementing Battle Fleet.

### Existing Family Selection

The existing scripts already support dynamically selected game-family identifiers.

The family is stored in Linkset Data using `cn.fam`.

The HTTP and display scripts normalize family names and accept valid lowercase family slugs.

Use:

`battlefleet`

The existing HTTP system does not require a hardcoded list of all game families. New web families can be selected through the existing mechanism, subject to the existing entitlement system.

The registration script must also be configured appropriately for the new family if Battle Fleet is a separately registered/purchased game.

Do not modify existing family registration behavior.

## 1.3 Existing Session Behavior and Constraints

The existing table system has four physical seats.

It already supports:

**Solo sessions**
- One active human player.
- Configurable total player count, up to four.
- The solo session identifies the human player and provides the player roster to the display.
- Computer-controlled opponents must be implemented by Battle Fleet itself.

**Multiplayer sessions**
- Existing lobby.
- Human host.
- Joining players.
- Five-character room code.
- Up to four physical seats.
- Existing multiplayer start behavior requires at least two joined participants.

Do not silently change the existing multiplayer minimum-player requirement.

If Battle Fleet needs a special rule for mixed human/computer multiplayer games, identify the requirement and propose the smallest compatible change rather than altering the shared session behavior.

The existing scripts also support player departure and a temporary grace period for standing/reseating.

Battle Fleet must handle those situations without assuming that a player who temporarily disconnects has automatically forfeited.

## 1.4 Existing Display Behavior

The existing `Parlor_Display.lsl`:

- Loads the tabletop MoAP.
- Uses the selected game family when constructing the display URL.
- Uses the existing display capability.
- Provides four Furware text display areas.
- Receives display events for player names, scores, turns, and game-over status.

Its current generic event handler recognizes:

- `NAMES`
- `TURN`
- `SCORE`
- `CLEARSEAT`
- `GAME_OVER`

Battle Fleet needs a considerably richer visual display.

The battlefield itself should be rendered by a Battle Fleet-specific web application.

Do not attempt to implement the 20×20 battlefield by replacing the existing generic Furware player information display.

Preserve the generic display functionality wherever possible.

The existing HTTP system also supports board-data storage and transfer. Inspect its existing board-data conventions and determine how the Battle Fleet web application should use them.

## 1.5 Existing HUD Behavior

The supplied files show that the table rezzes the existing HUD object and sends player/session information through the established communication mechanism.

The actual HUD web application and its internal game communication conventions are not included in the supplied files.

Therefore, before implementing Battle Fleet:

- Inspect the existing HUD application.
- Identify how the HUD determines its selected game family.
- Identify how it retrieves the player's session information.
- Identify how it sends player actions.
- Identify how it receives game updates.
- Identify how the HUD communicates with the table and tabletop display.
- Reuse the existing patterns.

Battle Fleet must not introduce a second, incompatible HUD communication system.

---

# PART 2 – GAME OVERVIEW

## 2.1 Basic Concept

Battle Fleet is a turn-based naval combat game.

Players command fleets of five ships positioned on a tactical grid.

Each player attempts to locate and destroy the opposing fleets while keeping the location of their own surviving ships secret.

Players take turns selecting coordinates to attack.

Each attack produces either a HIT or MISS.

A ship is destroyed when every cell it occupies has been hit.

The last surviving player or team wins.

## 2.2 Two Separate Interfaces

### Player HUD

The player's private interface.

Used for:

- Viewing personal fleet placement.
- Positioning ships.
- Rotating ships.
- Confirming fleet placement.
- Selecting opposing territories.
- Selecting attack coordinates.
- Confirming attacks.
- Viewing attack history.
- Viewing fleet damage.
- Viewing scores and statistics.
- Viewing game announcements.

### Tabletop Display

The public interface.

Used for:

- Displaying the complete battlefield.
- Showing hits and misses.
- Showing destroyed ships.
- Showing active player and team information.
- Showing turn order.
- Showing scores.
- Showing fleet status.
- Announcing important game events.
- Displaying the winner and final results.

The tabletop display must never reveal the location of surviving enemy ships.

---

# PART 3 – BATTLEFIELD DESIGN

## 3.1 Overall Battlefield

The battlefield consists of a 20×20 grid.

It is divided into four 10×10 quadrants.

The arrangement is:

| Player 1 | Player 2 |
|---|---|
| Player 3 | Player 4 |

Each quadrant represents one player's territory in free-for-all games.

The entire battlefield contains 400 cells.

Coordinates should be clearly identifiable.

Use columns A–T and rows 1–20 for the complete battlefield.

The HUD may use local coordinates A–J and 1–10 when displaying an individual player's territory.

## 3.2 Individual Player Territories

In free-for-all games:

- Player 1 owns the upper-left quadrant.
- Player 2 owns the upper-right quadrant.
- Player 3 owns the lower-left quadrant.
- Player 4 owns the lower-right quadrant.

Each player places their five ships entirely within their own 10×10 territory.

Players may attack any other active player's territory.

They cannot attack their own territory.

Unused quadrants are inactive.

## 3.3 Two-Player Games

In two-player games, use diagonally opposite quadrants.

Recommended arrangement:

| Player 1 | Inactive |
|---|---|
| Inactive | Player 2 |

This gives each player a distinct 10×10 territory and leaves the unused portions of the display visually inactive.

## 3.4 Three-Player Games

Three players occupy three quadrants.

The fourth quadrant remains inactive.

Players may attack either of the other two players.

The unused quadrant must not be targetable.

## 3.5 Four-Player Games

All four quadrants are active.

Each player has their own fleet and territory.

Players may attack any of the other three players.

## 3.6 Team Battlefield

Team games use a fundamentally different territory arrangement.

The battlefield is divided into two halves, each measuring 10×20.

| Team A – Player 1 | Team A – Player 1 |
|---|---|
| Team A – Player 2 | Team A – Player 2 |

For clarity, the actual arrangement is:

- Team A owns the entire upper half of the battlefield (rows 1–10).
- Team B owns the entire lower half (rows 11–20).

Each team controls two adjacent 10×10 quadrants.

**Important: Team territory is a single continuous 10×20 area.**

The original quadrant boundaries are not ship-placement boundaries in team games.

A team may position its ships anywhere within its combined territory.

For example:

- A ship may be entirely within the left half.
- A ship may be entirely within the right half.
- A ship may cross the boundary between the original quadrants.
- A ship may be positioned anywhere else within the team's 10×20 area.

Ships must remain entirely within the team's territory.

The opposing team owns the other 10×20 half.

## 3.7 Team Assignments

Four-player team games must use two teams of two.

Recommended default:

- Team A: Seats 1 and 2.
- Team B: Seats 3 and 4.

However, team assignments must be logical game assignments, not hardcoded assumptions about physical seat numbers.

If the existing game lobby permits a different seating arrangement, the game should still be able to assign players to teams correctly.

The HUD and table display must clearly identify team membership.

---

# PART 4 – FLEET COMPOSITION

## 4.1 Standard Fleet

Each individual player or team receives an identical fleet of five ships.

| Ship | Length | Number |
|---|---:|---:|
| Aircraft Carrier | 5 cells | 1 |
| Battleship | 4 cells | 1 |
| Cruiser | 3 cells | 1 |
| Submarine | 3 cells | 1 |
| Destroyer | 2 cells | 1 |
| **Total** | **17 cells** | **5 ships** |

Each ship occupies a straight line of consecutive cells.

Ships may be positioned horizontally or vertically.

Ships may touch one another, including diagonally.

Ships may not overlap.

## 4.2 Team Fleets

In team games, each team receives one shared fleet of five ships.

The fleet is not duplicated for each teammate.

Both teammates share:

- The same ships.
- The same fleet placement.
- The same damage.
- The same ship losses.
- The same remaining fleet strength.

---

# PART 5 – SHIP PLACEMENT

## 5.1 Placement Phase

After the game starts, all players enter the placement phase.

Players must position their entire fleet before battle begins.

The HUD should provide:

- Ship selection.
- Ship orientation.
- Grid position selection.
- Placement confirmation.
- Ship repositioning.
- Ship removal.
- Random fleet placement.
- Placement completion status.

## 5.2 Placement Rules

1. All five ships must be placed.
2. Ships must be horizontal or vertical.
3. Ships must occupy consecutive cells.
4. Ships cannot overlap.
5. Ships cannot extend outside the assigned territory.
6. Ships may touch other ships.
7. Ships may be moved freely before placement is confirmed.
8. Once confirmed, the fleet is locked when the battle begins.

## 5.3 Random Placement

Provide a Random Placement button.

It must generate a valid fleet arrangement.

Random placement must:

- Include all five ships.
- Avoid overlapping ships.
- Keep all ships inside the territory.
- Respect the team's combined 10×20 territory in team games.

Players may randomize repeatedly until satisfied.

## 5.4 Team Placement

Both teammates can view the team's entire 10×20 placement area.

They should be able to coordinate their fleet placement.

The team has one shared placement configuration.

The team cannot begin battle until all five ships are positioned and the shared fleet is confirmed.

A team must never end up with two separate fleets because each teammate independently placed ships.

---

# PART 6 – BATTLE RULES

## 6.1 Turn-Based Combat

After all fleets have been confirmed, the game enters the battle phase.

The game randomly determines the starting player.

Turns proceed through the active players.

Every player gets one attack per turn.

A hit does not grant an additional attack.

A miss does not grant an additional attack.

This keeps turn order predictable and balanced.

## 6.2 Free-for-All Turn Order

In four-player free-for-all games, turns proceed in physical seat order, skipping eliminated players.

Example:

1. Player 1
2. Player 2
3. Player 3
4. Player 4
5. Repeat.

The first player is selected randomly.

The same principle applies to three-player and two-player games.

## 6.3 Team Turn Order

In team games, both teammates participate.

The turn order alternates between the teams.

Example:

1. Team A – Player 1
2. Team B – Player 3
3. Team A – Player 2
4. Team B – Player 4
5. Repeat.

This gives each team two attacks during a complete four-player round.

If a teammate becomes unavailable, the remaining active teammate should continue participating in the team's turns.

A team does not lose its turn simply because one teammate has left.

## 6.4 Selecting a Target

During their turn, the player selects an opposing territory and then selects a coordinate.

In free-for-all games, the target must belong to another active player.

In team games, the target must be within the opposing team's 10×20 territory.

The player confirms the attack through the HUD.

## 6.5 Attack Results

Every attack produces one of two results.

**HIT**

The selected cell contains part of an opposing ship.

The cell is marked as a hit.

The ship's remaining health is reduced by one.

**MISS**

The selected cell does not contain an opposing ship.

The cell is marked as a miss.

The attacker receives immediate feedback.

The table display updates.

## 6.6 Repeated Attacks

A player cannot attack the same coordinate twice.

In team games, both teammates share the same attack history.

A coordinate attacked by one teammate cannot be attacked by the other teammate.

An invalid or repeated attack must be rejected without consuming the player's turn.

## 6.7 Attack History

Players should be able to see all attacks made against their available targets.

The HUD should visually distinguish:

- Untested coordinates.
- Previous misses.
- Previous hits.
- Destroyed ships.

The public tabletop display shows the complete public attack history.

---

# PART 7 – SHIP DAMAGE AND DESTRUCTION

## 7.1 Individual Ship Health

Each ship has health equal to its length.

| Ship | Hits Required |
|---|---:|
| Aircraft Carrier | 5 |
| Battleship | 4 |
| Cruiser | 3 |
| Submarine | 3 |
| Destroyer | 2 |

Each successful hit damages one cell.

## 7.2 Sinking a Ship

When every cell belonging to a ship has been hit, the ship is sunk.

The game announces the event.

Examples:

"PLAYER 2 HAS SUNK PLAYER 1'S DESTROYER!"

"TEAM A HAS SUNK TEAM B'S BATTLESHIP!"

## 7.3 Public Disclosure

When a ship is sunk:

- Its entire location becomes visible on the public table display.
- Its cells are visually distinguished from ordinary hits.
- Its destruction is reflected in the fleet status.
- Its name is announced.

**A partially damaged ship must remain hidden except for its actual hit cells.**

For example, hitting one cell of a five-cell carrier reveals only that cell.

The remaining four cells must remain concealed.

The public display must never reveal the complete position of a surviving ship.

---

# PART 8 – PLAYER ELIMINATION

## 8.1 Free-for-All Elimination

A player is eliminated when all five ships have been sunk.

An eliminated player:

- Cannot make further attacks.
- Is skipped in turn order.
- Remains visible on the table display.
- Can continue watching the game.
- Retains their final statistics.

The remaining players continue until only one player has surviving ships.

## 8.2 Team Elimination

A team is eliminated when all five of its ships have been sunk.

The opposing team wins.

Elimination applies to the entire team, not to an individual teammate.

A team cannot be eliminated simply because one teammate's original quadrant has been attacked or destroyed.

The entire combined fleet must be destroyed.

---

# PART 9 – PLAYER HUD DESIGN

The HUD should follow the existing Parlor HUD's visual conventions and navigation patterns.

Do not redesign the entire HUD framework.

Add a Battle Fleet game interface that fits into the existing family-selection and game-loading behavior.

## 9.1 Lobby/Configuration

The game should display:

- Game title.
- Current game mode.
- Player roster.
- Computer opponent configuration where applicable.
- Team assignments where applicable.
- Ready status.
- Start status.

Use existing Parlor session and lobby information.

Do not create a duplicate lobby.

## 9.2 Placement Screen

Show:

- The player's placement grid.
- Available ships.
- Ship sizes.
- Current ship orientation.
- Placement controls.
- Remaining ships.
- Confirmation status.
- Random Placement button.

In team games, show the complete 10×20 team territory.

## 9.3 Battle Screen

Show:

- Target selection.
- Opposing territory grids.
- Attack history.
- Hit and miss markers.
- Sunk ships.
- Personal fleet health.
- Remaining ships.
- Current turn.
- Current score.
- Opponent status.

A player must never see the positions of surviving enemy ships.

## 9.4 Waiting State

When it is not the player's turn, clearly indicate that the player is waiting.

Display the current active player.

Do not allow attacks outside the player's turn.

## 9.5 Defeated State

When a player's fleet is destroyed:

- Disable attack controls.
- Display the elimination status.
- Continue displaying the public battlefield.
- Allow the player to watch the remainder of the game.

---

# PART 10 – TABLETOP DISPLAY DESIGN

## 10.1 Overall Presentation

The tabletop display is the centerpiece of Battle Fleet.

It should show the entire 20×20 battlefield in a clear, visually appealing manner.

It must be designed for viewing on the physical Second Life table, where several avatars may be gathered around it.

The display should prioritize battlefield readability over excessive decorative elements.

## 10.2 Battlefield Grid

Display the full 20×20 battlefield.

Show:

- Active and inactive territories.
- Territory boundaries.
- Player or team identification.
- Grid coordinates.
- Missed attacks.
- Successful hits.
- Sunk ships.
- Recent attack highlighting.

Use distinct visual symbols for hits and misses.

Do not rely exclusively on color to distinguish attack results.

## 10.3 Player Information

Each player should have an information area showing:

- Player name.
- Player color.
- Current status.
- Number of surviving ships.
- Remaining ship cells.
- Total hits scored.
- Total misses.
- Ships sunk.
- Score.

In team games, show:

- Team name.
- Team members.
- Combined surviving ships.
- Combined remaining ship cells.
- Combined score.
- Individual player statistics.

## 10.4 Turn Information

Clearly identify:

- Whose turn it is.
- Which team is attacking.
- Which territory is being targeted.
- The most recent attack.
- The result of the most recent attack.

## 10.5 Announcements

Display important events:

- Game started.
- Player's turn.
- Hit.
- Miss.
- Ship sunk.
- Player eliminated.
- Team eliminated.
- Game won.

Recent attacks should receive a brief visual highlight or animation.

## 10.6 Public Information Restrictions

The tabletop display must not expose:

- Surviving enemy ship locations.
- Unattacked cells containing ships.
- Private placement information.
- Computer-player internal decision information.

Only publicly revealed information may be shown.

---

# PART 11 – COMPUTER OPPONENTS

## 11.1 General Requirements

Computer opponents are a Battle Fleet game feature, not a responsibility of the existing Parlor table controller.

They must participate under the same rules as human players.

They must:

- Receive a valid territory.
- Position all five ships.
- Confirm their fleet.
- Take turns.
- Select legal attack coordinates.
- Track their previous attacks.
- Recognize hits and misses.
- Continue playing until eliminated or victorious.

They must not have access to hidden enemy ship locations.

## 11.2 Single-Player Configurations

Allow the human player to select:

- 1 human vs. 1 computer.
- 1 human vs. 2 computers.
- 1 human vs. 3 computers.

The existing Parlor solo-session mechanism should be reused.

The game should map its logical players to the existing session/player positions appropriately.

The computer players must appear as normal participants on the tabletop display, with recognizable computer-player names.

## 11.3 Difficulty Levels

Provide three difficulty levels.

**Easy**

- Random fleet placement.
- Random selection of untested attack coordinates.
- No advanced hunting strategy.

**Normal**

- Uses a basic hunting strategy.
- After a successful hit, considers neighboring coordinates.
- Attempts to identify ship orientation.
- Avoids known misses and previously attacked cells.

**Hard**

- Uses more advanced targeting.
- Tracks possible ship orientations.
- Uses remaining ship sizes to narrow possible locations.
- Avoids inefficient attacks where remaining ships cannot fit.
- Uses more strategic fleet placement.

Difficulty must affect decision-making, not access to hidden information.

## 11.4 Computer Turn Timing

Computer opponents should have a reasonable response delay.

They should not attack instantaneously after the previous player's turn.

A brief delay makes the game feel more natural and gives the table display time to communicate the previous result.

---

# PART 12 – TEAM GAME RULES

## 12.1 Shared Fleet

Each team has one fleet of five ships.

Both teammates share the fleet.

The fleet occupies the entire team's 10×20 territory.

## 12.2 Shared Damage

All damage affects the shared fleet.

If a ship is sunk, both teammates lose that ship.

## 12.3 Shared Attack History

Both teammates see the same attack history.

Neither teammate can repeat an attack made by the other.

## 12.4 Individual Turns

Both teammates receive their own turns.

The turn order alternates between teams.

## 12.5 Individual Statistics

Track for each teammate:

- Attacks.
- Hits.
- Misses.
- Ships sunk.
- Points earned.

## 12.6 Combined Team Statistics

Track:

- Total team attacks.
- Total team hits.
- Total team misses.
- Total ships sunk.
- Total remaining ships.
- Total remaining ship cells.
- Combined score.

---

# PART 13 – SCORING SYSTEM

## 13.1 Basic Scoring

Recommended default scoring:

| Event | Points |
|---|---:|
| Successful hit | 10 |
| Sink an opposing ship | 20 bonus |
| Win the game | 50 bonus |
| Miss | 0 |

The sinking bonus is awarded in addition to the points for individual hits.

In team games, the teammate who makes the attack receives the individual points.

The points also contribute to the combined team score.

## 13.2 Statistics

Track:

- Total attacks.
- Total hits.
- Total misses.
- Hit percentage.
- Ships sunk.
- Ships lost.
- Games won.
- Games lost.
- Total points.

Hit percentage:

Hits ÷ Total Attacks × 100.

Scoring does not determine victory.

Victory is determined by fleet destruction.

---

# PART 14 – GAME FLOW

The standard game sequence is:

1. Players sit at the existing Parlor table.
2. The existing system attaches their HUDs.
3. Players select Battle Fleet.
4. The existing Parlor family and entitlement mechanisms are used.
5. Players select or join the appropriate session.
6. Game configuration is established.
7. Computer opponents are added where applicable.
8. Team assignments are made if applicable.
9. The game determines the starting player.
10. Placement phase begins.
11. Players position their fleets.
12. All fleets are confirmed.
13. Battle phase begins.
14. Players take turns attacking.
15. The game records hits, misses, and sinking events.
16. Eliminated players or teams are identified.
17. The game continues until victory conditions are met.
18. Final statistics are calculated.
19. The tabletop display announces the winner.
20. The post-game screen allows players to review results and start another game.

---

# PART 15 – DISCONNECTIONS AND EDGE CASES

## 15.1 Temporary Disconnection

Use the existing Parlor grace/reconnect behavior.

A player who temporarily stands or disconnects should not immediately lose their fleet.

Their game state must remain intact during the permitted grace period.

## 15.2 Permanent Departure

If a player permanently leaves:

- The game should recognize the departure.
- The player should not continue receiving turns.
- The remaining game should handle the vacancy appropriately.

In a solo game, a human departure should end or suspend the session according to the existing Parlor behavior.

In multiplayer, the host and remaining players should receive an appropriate notification.

For team games, if one teammate leaves, the remaining teammate should be able to continue playing for the team.

Do not automatically remove a team's shared fleet because one teammate disconnects.

## 15.3 Host Departure

Respect the existing Parlor host and session rules.

Do not independently invent a new host-transfer mechanism.

If the existing system terminates the match when its host leaves, Battle Fleet must handle that outcome gracefully.

## 15.4 Invalid Placement

Invalid placements must be rejected with a clear explanation.

Examples:

- Ship overlaps another ship.
- Ship extends outside the territory.
- Ship has an invalid orientation.
- Ship has not been positioned.

## 15.5 Incomplete Fleet

Battle cannot begin until every player or team has all five ships positioned and confirmed.

## 15.6 Invalid Attacks

Reject:

- Attacks outside the current player's turn.
- Attacks against their own territory.
- Attacks against inactive territories.
- Attacks against eliminated players.
- Repeated attacks.
- Attacks outside the grid.

Invalid attacks must not consume the turn.

## 15.7 Eliminated Players

Eliminated players must be skipped during turn selection.

They remain spectators.

## 15.8 Simultaneous Elimination

Evaluate all elimination conditions before determining the winner.

If a situation produces multiple simultaneous eliminations, apply a consistent result rather than arbitrarily selecting a winner.

## 15.9 Game Cancellation

Use the existing Parlor game-ending/reset mechanisms.

The table owner or authorized controller should be able to cancel an active game.

Players should be returned to the appropriate lobby or idle state.

---

# PART 16 – VICTORY CONDITIONS AND FINAL RESULTS

## 16.1 Two-Player Games

The first player to sink the opposing fleet wins.

## 16.2 Three-Player Games

The last player with surviving ships wins.

## 16.3 Four-Player Free-for-All

The last player with surviving ships wins.

## 16.4 Team Games

The first team to sink the opposing team's entire fleet wins.

## 16.5 Final Results

The final screen should display:

- Winning player or team.
- Final player standings.
- Ships remaining.
- Total hits.
- Total misses.
- Ships sunk.
- Hit percentage.
- Final scores.
- Game duration.

Final scores should be reported through the existing Parlor score-reporting conventions where applicable.

Inspect `Parlor_Scores.lsl` and the existing scoreboard protocol before deciding whether any family-specific configuration or minimal extension is necessary.

Do not break existing card-game score reporting.

---

# PART 17 – FUTURE GAME VARIATIONS

The initial release should concentrate on the standard game.

However, the game should be organized so additional variations can be introduced later.

Potential future features:

**Salvo Mode**

Players receive multiple attacks based on the number of surviving ships.

**Radar Scan**

A limited-use ability that identifies whether a selected area contains enemy ship cells without revealing their exact locations.

**Minefields**

Certain cells contain hidden mines.

**Special Weapons**

Examples include depth charges, radar scans, and limited-use area attacks.

**Tournament Mode**

Multiple rounds with cumulative player rankings.

**Timed Battles**

Players have a limited time to complete each turn.

These features are not requirements for the initial release.

Do not implement them as part of the initial game unless specifically requested.

---

# PART 18 – INITIAL RELEASE REQUIREMENTS

The initial release must include:

1. Battle Fleet as a new Parlor game family.
2. One human against one to three computer opponents.
3. Two-player head-to-head games.
4. Three-player free-for-all.
5. Four-player free-for-all.
6. Four-player team games.
7. Correct 20×20 battlefield.
8. Correct four-quadrant free-for-all layout.
9. Correct 10×20 team territory layout.
10. Correct shared team fleet placement.
11. Five-ship fleet composition.
12. Valid fleet placement and random placement.
13. Turn management.
14. Hit and miss mechanics.
15. Ship damage and sinking.
16. Player elimination.
17. Team elimination.
18. Victory conditions.
19. Player HUD.
20. Public tabletop battlefield display.
21. Computer opponent logic.
22. Basic computer difficulty.
23. Scoring and statistics.
24. Final results display.
25. Compatibility with the existing Parlor session and registration system.

Advanced computer difficulty and special weapons may be refined in subsequent releases.

---

# PART 19 – IMPLEMENTATION GUIDANCE FOR CURSOR

This section is especially important.

The purpose of this document is to describe the game and its expected behavior. It is not permission to redesign the existing Parlor system.

## 19.1 Inspect Before Coding

Before making changes:

1. Inspect all five supplied Parlor LSL scripts.
2. Inspect the existing HUD application.
3. Inspect the existing tabletop web application.
4. Inspect the existing game-family selection mechanism.
5. Inspect the existing board-data transfer mechanism.
6. Inspect how existing games send player actions and receive updates.
7. Inspect how existing games report scores.
8. Identify the existing deployment and asset-revision conventions.

Prepare a brief implementation assessment identifying:

- What can be reused without modification.
- What Battle Fleet needs to add.
- Which existing files, if any, require modification.
- Whether any changes to shared infrastructure are genuinely necessary.

Do not begin by rewriting existing files.

## 19.2 Keep Game-Specific Logic Isolated

Battle Fleet should have its own game-specific:

- Game state.
- Fleet placement rules.
- Attack processing.
- Ship damage tracking.
- Turn management.
- Player elimination.
- Team logic.
- Computer opponent logic.
- Scoring.
- HUD interface.
- Tabletop battlefield interface.

Existing shared Parlor infrastructure should continue handling the responsibilities it already owns.

## 19.3 Do Not Assume Physical Seat Equals Logical Player

The existing system has four physical seats.

However, Battle Fleet must distinguish between:

- Physical table seat.
- Human avatar.
- Logical game player.
- Computer opponent.
- Team membership.
- Active or eliminated status.

In solo games, computer opponents must be mapped into the game's logical player positions without requiring additional physical avatars or seats.

In team games, logical team assignments must be independent of physical seat assumptions.

## 19.4 Keep Private and Public Game Information Separate

This is critical.

The game has information that must remain private and information that can be publicly displayed.

**Private information:**
- Locations of surviving ships.
- Unattacked ship cells.
- Fleet placement before battle.
- Computer opponent internal targeting data.

**Public information:**
- Attack locations.
- Hits.
- Misses.
- Sunk ship locations.
- Player scores.
- Remaining ships.
- Turn information.
- Elimination status.

The public tabletop display must receive only information appropriate for public viewing.

A player HUD may receive the private information required by that player, but must not receive another player's hidden fleet placement.

This restriction applies to computer opponents as well.

## 19.5 Preserve Existing Scoreboard Compatibility

Review the existing score-reporting implementation.

Battle Fleet may require a family-specific game identifier or small compatible addition.

Do not alter the existing scoreboard protocol in a way that breaks Canasta or other games.

## 19.6 Avoid Unnecessary LSL Changes

The existing LSL system already handles:

- Table seating.
- Player identification.
- HUD rezzing.
- Session creation.
- Multiplayer joining.
- Room codes.
- Solo session claims.
- Display loading.
- Entitlement checks.
- Board-data transport.
- Reconnect/grace handling.

Battle Fleet should reuse these capabilities.

If a required behavior cannot be achieved through the existing interfaces, explain why before changing shared LSL scripts.

Any necessary modifications must preserve existing game behavior.

## 19.7 Deployment Compatibility

Follow the existing deployment conventions.

Inspect how the current web applications are hosted and how their asset revisions are managed.

Do not introduce a new hosting or deployment mechanism.

The Battle Fleet application should be selected through the existing family mechanism.

## 19.8 Implementation Phases

Implement and test the game in logical phases.

**Phase 1 – Foundation**

- New game family.
- Basic game initialization.
- Player and computer-player representation.
- Battlefield model.
- Fleet composition.

**Phase 2 – Placement**

- Individual placement.
- Team placement.
- Rotation.
- Random placement.
- Placement validation.
- Confirmation.

**Phase 3 – Combat**

- Turn management.
- Target selection.
- Hits and misses.
- Damage.
- Ship sinking.
- Attack history.

**Phase 4 – Multiplayer and Teams**

- Two-player.
- Three-player.
- Four-player free-for-all.
- Team assignments.
- Shared fleet.
- Team turns.
- Team elimination.

**Phase 5 – Computer Opponents**

- Fleet placement.
- Random targeting.
- Hunting strategy.
- Difficulty levels.

**Phase 6 – Presentation**

- Player HUD.
- Public tabletop battlefield.
- Player statistics.
- Announcements.
- Final results.

**Phase 7 – Integration and Testing**

- Solo sessions.
- Multiplayer sessions.
- Reconnect behavior.
- Player departures.
- Scoreboard compatibility.
- Existing card-game regression testing.

Do not consider the game complete merely because the basic two-player game works.

All required game modes must be tested.

---

# PART 20 – ACCEPTANCE TESTS

The initial release must pass the following functional tests.

| Test | Expected result |
|---|---|
| 1 human vs. 1 computer | Game starts, both fleets are placed, battle proceeds correctly |
| 1 human vs. 2 computers | Three-player game works |
| 1 human vs. 3 computers | Four-player game works |
| 2 human players | Head-to-head game works |
| 3 human players | Three-player free-for-all works |
| 4 human players | Four-player free-for-all works |
| 4 human team game | Two teams share one fleet each |
| Team ship crossing quadrant boundary | Placement is accepted when within team territory |
| Ship overlap | Placement is rejected |
| Ship outside territory | Placement is rejected |
| Repeated attack | Rejected without consuming turn |
| Hit | Correct ship damage is recorded |
| Ship sunk | Complete ship location becomes public |
| Surviving ship | Remaining location stays hidden |
| Player eliminated | Player is skipped in future turns |
| Team elimination | Opposing team wins |
| Computer difficulty | Different levels use different targeting behavior |
| Player disconnect | Existing grace/reconnect behavior is respected |
| Team member disconnect | Remaining teammate can continue |
| Table display | Shows public battlefield accurately |
| HUD | Shows private player information correctly |
| Final score | Correct statistics are reported |
| Existing card games | Continue functioning without regression |

---

# FINAL DESIGN PRINCIPLE

Battle Fleet should feel like a natural extension of the existing Parlor table game collection.

Players should be able to sit down, select a game, join or create a session, position their fleets, and begin playing without needing to understand anything about the underlying implementation.

The existing Parlor system should continue doing what it already does well.

Battle Fleet should introduce the new gameplay, strategy, battlefield visualization, and computer opponents while preserving the established infrastructure and compatibility of the existing games.

**The priority is to build a complete, enjoyable naval strategy game that fits into the existing Parlor ecosystem—not to rebuild the Parlor ecosystem to accommodate one new game.**

# END OF SPECIFICATION