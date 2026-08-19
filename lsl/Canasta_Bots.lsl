// Canasta — Seat bots (linked prims named bot1–bot4).
// Drop in the table linkset (root is fine). Compile: Mono.
// Listens to the same Start / Reset / Event bus as Display.
// Hide = Blinn-Phong alpha 0 + PBR base alpha 0 in blend mode.
// Show = Blinn-Phong alpha 1 + clear PBR alpha overrides.

integer DISPLAY_CMD_EVENT = 91001;
integer DISPLAY_CMD_START = 91002;
integer DISPLAY_CMD_RESET = 91003;

integer MAX_SEATS = 4;

// Strided [seat, link, seat, link, ...]
list gBot = [];
integer gShowBits = 0;

integer scanBots()
{
    gBot = [];
    integer prims = llGetObjectPrimCount(llGetKey());
    if (prims < 1) prims = llGetNumberOfPrims();
    integer i;
    for (i = 1; i <= prims; i++)
    {
        string nm = llToLower(llStringTrim(llGetLinkName(i), STRING_TRIM));
        integer seat = -1;
        if (nm == "bot4" || llGetSubString(nm, 0, 3) == "bot4") seat = 3;
        else if (nm == "bot3" || llGetSubString(nm, 0, 3) == "bot3") seat = 2;
        else if (nm == "bot2" || llGetSubString(nm, 0, 3) == "bot2") seat = 1;
        else if (nm == "bot1" || llGetSubString(nm, 0, 3) == "bot1") seat = 0;
        if (seat >= 0) gBot += [seat, i];
    }
    return llGetListLength(gBot) / 2;
}

setLinkVisible(integer link, integer vis)
{
    if (link < 1) return;
    if (vis)
    {
        llSetLinkAlpha(link, 1.0, ALL_SIDES);
        llSetLinkGLTFOverrides(link, ALL_SIDES, [
            OVERRIDE_GLTF_BASE_ALPHA_MODE, "",
            OVERRIDE_GLTF_BASE_ALPHA, ""
        ]);
        return;
    }
    llSetLinkAlpha(link, 0.0, ALL_SIDES);
    llSetLinkPrimitiveParamsFast(link, [
        PRIM_ALPHA_MODE, ALL_SIDES, PRIM_ALPHA_MODE_BLEND, 0
    ]);
    llSetLinkGLTFOverrides(link, ALL_SIDES, [
        OVERRIDE_GLTF_BASE_ALPHA_MODE, PRIM_GLTF_ALPHA_MODE_BLEND,
        OVERRIDE_GLTF_BASE_ALPHA, 0.0
    ]);
}

applyMask(integer showBits)
{
    gShowBits = showBits;
    integer n = llGetListLength(gBot);
    integer i;
    for (i = 0; i < n; i += 2)
    {
        integer seat = llList2Integer(gBot, i);
        integer link = llList2Integer(gBot, i + 1);
        integer vis = FALSE;
        if (showBits & (1 << seat)) vis = TRUE;
        setLinkVisible(link, vis);
    }
}

hideAll()
{
    applyMask(0);
}

integer maskFromStart(string payload)
{
    list p = llParseStringKeepNulls(payload, ["|"], []);
    string kind = llList2String(p, 0);
    integer show = 0;
    integer s;
    if (kind == "solo")
    {
        integer nPlayers = (integer)llList2String(p, 1);
        integer humanSeat = (integer)llList2String(p, 2);
        if (nPlayers < 1) nPlayers = 1;
        if (nPlayers > MAX_SEATS) nPlayers = MAX_SEATS;
        if (humanSeat < 0 || humanSeat >= nPlayers) humanSeat = 0;
        for (s = 0; s < nPlayers; s++)
        {
            if (s != humanSeat) show = show | (1 << s);
        }
        return show;
    }
    for (s = 0; s < MAX_SEATS; s++)
    {
        if (llList2String(p, s + 1) == "") show = show | (1 << s);
    }
    return show;
}

default
{
    state_entry()
    {
        scanBots();
        hideAll();
        llOwnerSay("Canasta bots: " + (string)(llGetListLength(gBot) / 2) + " prims (bot1–bot4).");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_LINK)
        {
            scanBots();
            applyMask(gShowBits);
        }
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == DISPLAY_CMD_RESET)
        {
            hideAll();
            return;
        }
        if (num == DISPLAY_CMD_START)
        {
            applyMask(maskFromStart(str));
            return;
        }
        if (num == DISPLAY_CMD_EVENT)
        {
            if (llGetSubString(str, 0, 8) == "GAME_OVER") hideAll();
        }
    }
}
