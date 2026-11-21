# Battle Fleet – UI/UX Visual Redesign

The Battle Fleet game is now functional and gameplay is working. I want you to concentrate on a substantial visual and layout redesign of the existing interface.

**IMPORTANT: This is a presentation/UI task, NOT a gameplay rewrite.**

Do not change game rules, fleet placement logic, targeting, turn management, multiplayer synchronization, computer opponents, scoring, or server communication. Preserve all existing functionality.

## 1. Battlefield – Highest Priority

The current 20×20 battlefield is much too small. It occupies only a small portion of the available display, leaving enormous amounts of unused space.

- Increase the battlefield size substantially, ideally approximately 2–2.5 times its current dimensions at the displayed resolution.
- Make the board responsive, using the available display area intelligently.
- Keep the entire 20×20 grid visible without requiring scrolling.
- Center the battlefield vertically and horizontally in its available area.
- Ensure individual cells remain large enough to be easily clicked or tapped.
- Add coordinate labels: A–T across the top and 1–20 down the side.
- Make the boundaries between the four 10×10 quadrants more visually apparent.
- Use a subtle but attractive ocean/naval tactical theme for the battlefield background.
- Preserve the distinction between player territories and neutral/unoccupied areas.

The battlefield should be the visual centerpiece of the application.

## 2. Overall Visual Theme

Give the application the appearance of a polished naval strategy game.

Consider:
- Deep navy and ocean-blue backgrounds.
- Subtle ocean textures or gradients.
- Steel, brass, and muted gold accents.
- Tactical display elements and subtle military/naval detailing.
- Clear typography with strong contrast.
- Tasteful visual effects, not excessive decoration.

The result should feel like a sophisticated naval command interface, not a generic HTML grid.

## 3. Right-Side Command Panel

Redesign the right panel to feel like a naval command station.

Organize it into clearly separated sections:

**Game Status**
- Current phase.
- Current game mode (FFA, team, etc.).
- Current player/team and whose turn it is.
- Important messages and game events.

**Fleet Placement**
- Five ship selection buttons.
- Visually indicate the currently selected ship.
- Show which ships have already been placed.
- Clearly indicate fleet placement completion.
- Keep rotation, random fleet, and confirm fleet controls.

**Scoreboard**
- Player/team names.
- Current scores.
- Ships sunk and remaining.
- Clear indication of eliminated players.
- Highlight the current player/team.

Use visual hierarchy rather than presenting everything as plain text.

## 4. Battlefield Colors and Status Indicators

Create a consistent visual language for:
- Unoccupied water.
- Friendly ships during placement.
- Missed shots.
- Successful hits.
- Sunk ships.
- Unknown/unrevealed enemy territory.

Include a small legend so players understand the colors.

Hits and misses should be immediately distinguishable, even at a glance.

## 5. Game-Over Presentation

The current game-over screen is particularly sparse.

Create a more impressive victory presentation:
- Prominent winner announcement.
- Final scores.
- Ships sunk and remaining.
- Accuracy and attack statistics, where available.
- A clearly visible New Match button.

Do not obscure the battlefield unnecessarily.

## 6. Responsive Layout

The application runs inside a Second Life Media-on-a-Prim display, so it must work well at the actual embedded display dimensions.

The design must:
- Scale intelligently with the available viewport.
- Avoid horizontal or vertical scrolling.
- Keep controls usable at different UI scale settings.
- Never allow the board or controls to be clipped.
- Make good use of the available screen area.

## 7. Preserve Existing Functionality

Before making changes, inspect the existing implementation and identify the CSS, HTML, and JavaScript responsible for rendering the interface.

Make presentation changes wherever possible without modifying game-state logic.

If a change requires touching gameplay code, explain why before doing so.

After the redesign, test:
- Ship placement.
- Fleet confirmation.
- All game modes.
- Target selection.
- Hit/miss display.
- Sinking and elimination.
- Turn changes.
- Victory and game-over screens.
- Different viewport sizes.

**The goal:** Make Battle Fleet look like a finished, premium naval strategy game while retaining the working game underneath.