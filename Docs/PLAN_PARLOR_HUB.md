# Parlor hub — multi-game table + purchase registration

Free (or paid) tables use one **hub** script set. Buying a game registers that family in Experience; any hub table owned by that avatar can play it.

## LSL (new — do not remove standalone `*_Table` SKUs until cutover)

| Script | Role |
|--------|------|
| `Parlor_Register.lsl` | On rez/attach: merge `GRANT_FAMILY` into `cn.ent.<ownerUUID>`. Edit `GRANT_FAMILY` per SKU. Ship **no-mod / no-transfer**. |
| `Parlor_Table.lsl` | Hub controller: read entitlements, `set_family`, runtime `CN_READY` family. |
| `Parlor_Http.lsl` | JSONP; status includes `hub`, `family`, `entitlements`. |
| `Parlor_Display.lsl` | Furware + MoAP; family from LSD / `91007`. |
| `Parlor_Scores.lsl` | Score shout; letter + partnership from family. |
| `Canasta_HUD.lsl` | Shared; listens for `CN_FAMILY\|tableId\|family`. |

**Experience value:** `v1|canasta,rummy,trick` (comma-separated families).  
**LSD cache:** `cn.ent` (CSV), `cn.fam` (selected family).

## Web

- Status `hub:true` + empty `family` → **Game selection** card grid (`*_ad.jpg` in `public/assets/`).
- Owned families clickable; others grayed (“Not registered”).
- Idle lobby: **All games** clears family and returns to the picker.

## Product packing

1. Free hub: Parlor Table/Http/Display/Scores (+ HUD/Bots) — **no** Register.  
2. Paid Canasta box/table: same hub scripts + Register with `GRANT_FAMILY = "canasta"`.  
3. Repeat Register constant for each family SKU.
