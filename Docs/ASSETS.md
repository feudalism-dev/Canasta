# UI assets

Tabletop art lives in `public/assets/` and is referenced via `src/ui/assets.ts` (respects Vite `base: '/Canasta/'`).

v1 uses **SVG + CSS** so card faces stay unique (not Bicycle) and sharp at HUD 1024.

| File | Use |
|------|-----|
| `favicon.svg` | App icon — basket / canasta motif |
| `card-back.svg` | Face-down stock, Foot packet, closed books |
| Felt / brass | CSS in `src/styles/parlor.css` (emerald + gold Art Deco) |

Card **faces** are drawn in `src/ui/CardFace.tsx` (rank, suit pip, joker). Closed books use red/black ribbons in CSS.

Optional later: ComfyUI parlor felt texture (`felt-table.png`) using the `comfy-local` skill, same pipeline as Road Trip.
