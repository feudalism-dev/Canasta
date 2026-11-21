# Battle Fleet – Integrate Naval Sprite Asset Sheet

I have provided a generated naval game asset sheet for Battle Fleet. I want you to integrate these assets into the existing game to give the battlefield recognizable ships, improved sunk-ship graphics, and some polished naval interface decorations.

This is an extension of the existing working game. Do not rewrite gameplay or change the game rules.

## 1. Inspect and Prepare the Asset Sheet

Use the supplied image asset sheet as your source.

It contains:
- Five intact overhead ship illustrations.
- Five corresponding damaged/burning ship illustrations.
- Metal frame corners.
- A metal divider.
- Compass rose.
- Radar graphic.
- Anchor.
- Explosion effect.
- Water ripple effect.

First inspect the image dimensions, transparency, and individual asset boundaries.

IMPORTANT:
- Do not assume the background is transparent. Check its alpha channel.
- If the background is black rather than transparent, remove it carefully without damaging the dark ship details.
- Crop individual assets with appropriate transparent padding.
- Preserve the original aspect ratios.
- Do not stretch ships to fit rectangular areas.

Create individual optimized PNG files.

Organize them in the existing project's asset structure, preferably:

assets/
  ships/
    carrier.png
    carrier-sunk.png
    battleship.png
    battleship-sunk.png
    cruiser.png
    cruiser-sunk.png
    submarine.png
    submarine-sunk.png
    destroyer.png
    destroyer-sunk.png
  effects/
    explosion.png
    water-ripple.png
  chrome/
    compass.png
    radar.png
    anchor.png
    metal-corner.png
    metal-divider.png

Adjust paths to match the existing project conventions if necessary.

## 2. Ship Sprite Integration

The ships must be rendered as sprites positioned over the existing battlefield grid.

They must NOT replace the underlying grid cells or change the game's placement data.

Each ship must occupy precisely its existing number of cells:

| Ship | Length |
|---|---:|
| Aircraft Carrier | 5 cells |
| Battleship | 4 cells |
| Cruiser | 3 cells |
| Submarine | 3 cells |
| Destroyer | 2 cells |

The ship image should fit inside the exact rectangular footprint of its occupied cells.

Ships in the supplied artwork are oriented vertically, with their bow toward the top.

- Vertical placement: use the original orientation.
- Horizontal placement: rotate the sprite 90 degrees.
- Rotation must remain centered within the occupied grid-cell footprint.
- The image must never extend into adjacent unoccupied cells.
- Maintain correct positioning when the board is resized.

Use the actual ship placement coordinates and orientation from the existing game state. Do not independently calculate or maintain a second ship-position system.

## 3. Placement Screen

When a player is placing their fleet:

- Display recognizable ship sprites on the player's own battlefield.
- Show the selected ship in the placement preview.
- Show a translucent preview when moving the ship over the board, if practical.
- Show invalid placement feedback without changing existing placement validation.
- Ensure ship rotation works visually and matches the underlying placement orientation.

The result should look like a fleet of naval vessels positioned on an ocean tactical map, not colored rectangles.

## 4. Combat Screen – Hidden Information Is Critical

Preserve the existing hidden-information rules.

The player must always see their own surviving ships.

Enemy ships must remain invisible until they are completely sunk.

When an enemy ship is sunk:
- Reveal its complete location.
- Display the corresponding damaged/sunk ship sprite.
- Preserve all existing hit and miss markers.
- Make the sunk ship visually distinguishable from surviving friendly ships.

Never reveal an enemy ship's location through an image, CSS, DOM element, asset loading behavior, or other client-side information before the existing game rules permit it.

Do not expose private ship-placement data to unauthorized clients.

## 5. Sunk Ship Appearance

Use the damaged versions of the five ship sprites when a ship is completely sunk.

The wrecked appearance should be visible across the entire ship footprint, not just on the last cell hit.

Retain the existing hit indicators where useful, but ensure they do not obscure the ship artwork.

## 6. Combat Effects

Use the supplied effects sparingly:

- Explosion graphic for a successful hit.
- Water ripple graphic for a missed shot.
- Appropriate subtle visual treatment when a ship sinks.

Effects should be brief, visually attractive, and non-blocking.

Do not let animations interfere with clicking, targeting, or turn synchronization.

## 7. Interface Decorations

Use the supplied chrome elements selectively.

Possible uses:
- Compass rose in a small header or navigation area.
- Radar graphic as a decorative status-panel element.
- Metal divider between command-panel sections.
- Metal corner details around important panels.
- Anchor as a small naval decorative symbol.

Do not decorate every available surface. The battlefield and ships should remain the focus.

Maintain good readability at the actual Second Life Media-on-a-Prim resolution.

## 8. Performance and Implementation

- Optimize individual images for browser rendering.
- Avoid loading duplicate copies of the same sprite.
- Use CSS transforms or equivalent rendering techniques for rotation.
- Ensure sprites scale correctly with the grid.
- Keep sprites aligned to cell boundaries at all supported UI sizes.
- Avoid introducing large animation or rendering overhead.

## 9. Test Before Finishing

Test all five ship types in both orientations.

Verify:
- Correct footprint size.
- Correct alignment.
- Correct rotation.
- Correct placement preview.
- Own ships visible during combat.
- Enemy ships hidden until sunk.
- Sunk ships revealed in their correct locations.
- Hit and miss markers still work.
- All multiplayer modes preserve hidden information.
- No changes to existing game rules or synchronization.

## Final Goal

Transform the battlefield into a visually recognizable naval battle map with actual overhead ship illustrations, rather than colored squares.

Preserve the existing working game logic completely.

Before finishing, show me a screenshot of the updated placement screen and combat screen.