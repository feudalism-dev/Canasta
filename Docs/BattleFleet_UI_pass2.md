# Battle Fleet – Visual Refinement, Pass 2

The first UI redesign was a substantial improvement. The battlefield is now larger, coordinates are present, the territories are distinguishable, and the right-side panel is better organized.

However, the interface still looks like a functional web application rather than a polished naval strategy game.

I want another visual refinement pass.

**IMPORTANT: Do not rewrite the game. Do not change gameplay mechanics, networking, synchronization, game state, scoring, or rules. This is strictly a visual and presentation assignment.**

## 1. Establish a Stronger Naval Identity

The current interface uses a mostly flat blue background. I want a more sophisticated naval warfare aesthetic.

Think:
- Premium naval strategy game.
- Tactical command center.
- Deep ocean blues.
- Gunmetal and dark steel.
- Muted brass and gold accents.
- Subtle military/naval detailing.

Use subtle ocean textures, gradients, or water patterns in the background. Avoid anything that makes the grid difficult to read.

The result should feel atmospheric and immersive, not cartoonish.

## 2. Improve the Battlefield

The battlefield is currently approximately 435 pixels square in the supplied screenshot.

There is room to make it larger. Increase the grid to approximately 540–580 pixels square when the viewport permits, while maintaining responsiveness and ensuring all 20 rows and columns remain visible.

Improve the visual presentation of:
- Ocean cells.
- Player territories.
- Quadrant boundaries.
- Grid borders.
- Coordinate labels.

Use subtle variations in ocean-cell color to give the board more depth.

Make the four quadrants and their ownership immediately recognizable.

## 3. Make Ships Visually Recognizable

Explore replacing the plain colored ship-cell appearance during fleet placement with small, attractive top-down ship silhouettes.

The five ships should be visually distinguishable:
- Aircraft Carrier
- Battleship
- Cruiser
- Submarine
- Destroyer

The silhouettes must fit within the existing grid cells and occupy exactly the same cells as the underlying ship placement data.

Ships must rotate correctly when placed vertically.

Do not compromise placement accuracy, hit detection, or cell interaction.

During combat, preserve hidden information. Unrevealed enemy ships must never be displayed. Only show information the player is legitimately entitled to see.

If recognizable ship silhouettes prove impractical at this grid size, use attractive naval-inspired ship markers instead. Do not sacrifice readability.

## 4. Improve Combat Feedback

Add restrained visual feedback:
- A hit should produce a brief explosion or impact effect.
- A miss should produce a brief water splash or ripple.
- A sunk ship should have a distinctive visual appearance.
- Turn changes should be clearly indicated.
- Victory should have a tasteful presentation effect.

Animations must not interfere with gameplay, input, or synchronization.

Provide appropriate reduced-motion behavior if practical.

## 5. Upgrade the Right Command Panel

The current panel is functional but still looks like a basic collection of boxes and text.

Create a more polished tactical command panel.

Improve:
- Section headings.
- Player/team identification.
- Current-turn indicator.
- Scores.
- Fleet status.
- Ships sunk and remaining.
- Game events and notifications.
- Buttons and controls.

Use distinctive player/team colors consistently.

Make important numbers more prominent and improve readability at the actual Second Life display size.

## 6. Make Victory More Dramatic

The current victory display is too understated.

Create a more impressive victory section featuring:
- A prominent winner announcement.
- A clear winning-player or team identity.
- Final score.
- Accuracy and attack statistics.
- Ships sunk and remaining.
- A visually prominent New Match button.

Keep the battlefield visible.

## 7. Visual Consistency

Use a consistent design language throughout:
- Brass/gold for important highlights.
- Steel or metallic borders.
- Deep navy panels.
- Clear typography.
- Consistent spacing.
- Consistent button styling.
- Carefully chosen status colors.

Avoid excessive gradients, glows, animations, and decorative clutter.

This should feel premium and professional.

## 8. Preserve and Test Everything

Before changing anything, inspect the existing rendering implementation.

Prefer CSS and presentation-layer changes. Only modify JavaScript where necessary for visual feedback or rendering.

Do not alter the underlying game rules or data model.

After implementation, test placement, rotation, combat, hit/miss feedback, sinking, all game modes, hidden-information behavior, and victory presentation.

**Overall objective:** Transform Battle Fleet from a functional grid-based game into a visually immersive, polished naval strategy game, without compromising the working game underneath.