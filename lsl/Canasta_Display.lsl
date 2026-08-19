// Canasta — In-world display (Furware per-seat lines + table-top MOAP)
// Drop on the display child prim (same linkset as Table). Compile: Mono.
// Mesh names: FURWARE text mesh:text0:0:0 … text0:0:3 (and text1–text3).
// Also drop ONE script named "FURWARE text" in this linkset (from the Furware kit).
// The table prim (Table+Http+AVsitter) must be the linkset root, not a letter.
// This prim's media face is the spectator table top, oriented for Player 1.

integer DISPLAY_CMD_EVENT = 91001;
integer DISPLAY_CMD_START = 91002;
integer DISPLAY_CMD_RESET = 91003;
integer DISPLAY_RSP_RESET_DONE = 91004;
integer DISPLAY_CMD_CAP = 91005;
integer DISPLAY_CMD_NEED_CAP = 91006;

// Change this if the table-top media is not face 0.
integer DISPLAY_FACE = 0;
integer DISPLAY_MEDIA_PIXELS = 1024;
integer PAGE_ASSET_REV = 25;
string WEB_URL = "https://feudalism-dev.github.io/Canasta/";

integer DEBUG = FALSE;
integer MAX_SEATS = 4;

list gName = [];
integer gPlayers = 4;
integer gLive = FALSE;
integer gTurnSeat = -1;
integer gScoreA = 0;
integer gScoreB = 0;
string gSlCap = "";
string gLastHomeUrl = "";

integer debug(string m)
{
    if (DEBUG) llOwnerSay("CN DISPLAY: " + m);
    return TRUE;
}

string tableIdOf()
{
    key rootId = llGetLinkKey(LINK_ROOT);
    if (rootId == NULL_KEY) return (string)llGetKey();
    return (string)rootId;
}

string sessionHome()
{
    string home = WEB_URL
        + "?view=table"
        + "&tableId=" + llEscapeURL(tableIdOf())
        + "&uid=spec"
        + "&rev=" + (string)PAGE_ASSET_REV;
    if (gSlCap != "") home += "&sl_cap=" + llEscapeURL(gSlCap);
    return home;
}

integer applyMoap(integer force)
{
    if (gSlCap == "") return FALSE;
    string home = sessionHome();
    if (!force && home == gLastHomeUrl) return FALSE;

    string cur = home;
    if (force) cur = home + "&cb=" + (string)llGetUnixTime();

    if (force)
    {
        llClearPrimMedia(DISPLAY_FACE);
    }
    llSetPrimMediaParams(DISPLAY_FACE, [
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_CURRENT_URL, cur,
        PRIM_MEDIA_HOME_URL, home,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, FALSE,
        PRIM_MEDIA_WIDTH_PIXELS, DISPLAY_MEDIA_PIXELS,
        PRIM_MEDIA_HEIGHT_PIXELS, DISPLAY_MEDIA_PIXELS,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_NONE
    ]);
    gLastHomeUrl = home;
    debug("MoAP " + llGetSubString(cur, 0, 180));
    return TRUE;
}

integer askForCap()
{
    llMessageLinked(LINK_SET, DISPLAY_CMD_NEED_CAP, "", NULL_KEY);
    return TRUE;
}

string boxOf(integer seat)
{
    return "text" + (string)seat;
}

integer fwBox(string boxName, string body, string conf)
{
    llMessageLinked(LINK_SET, 0, conf, "fw_conf : " + boxName);
    llMessageLinked(LINK_SET, 0, body, "fw_data : " + boxName);
    return TRUE;
}

string clip(string s, integer maxLen)
{
    if (llStringLength(s) <= maxLen) return s;
    return llGetSubString(s, 0, maxLen - 1);
}

string labelFor(integer seat)
{
    string nm = llList2String(gName, seat);
    if (nm != "") return nm;
    return "P" + (string)(seat + 1);
}

integer scoreFor(integer seat)
{
    if (seat % 2 == 0) return gScoreA;
    return gScoreB;
}

integer paintSeat(integer seat)
{
    string conf = "a=left; w=none; t=on; force=on";
    string body = (string)(seat + 1) + " " + clip(labelFor(seat), 16);
    if (!gLive || seat >= gPlayers)
    {
        conf += "; c=0.85,0.78,0.55";
    }
    else
    {
        body += " " + (string)scoreFor(seat);
        if (gTurnSeat == seat)
        {
            body = "*" + body;
            conf += "; c=1.0,0.85,0.25";
        }
        else
        {
            conf += "; c=0.96,0.91,0.82";
        }
    }
    fwBox(boxOf(seat), body, conf);
    return TRUE;
}

integer paintAll()
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        paintSeat(i);
    }
    return TRUE;
}

integer clearState()
{
    gName = ["", "", "", ""];
    gPlayers = 4;
    gLive = FALSE;
    gTurnSeat = -1;
    gScoreA = 0;
    gScoreB = 0;
    return TRUE;
}

integer idleAttract()
{
    clearState();
    paintAll();
    debug("attract / idle");
    return TRUE;
}

integer takeNames(list parts, integer startAt)
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        string nm = "";
        integer idx = startAt + i;
        if (idx < llGetListLength(parts)) nm = llStringTrim(llList2String(parts, idx), STRING_TRIM);
        gName = llListReplaceList(gName, [nm], i, i);
    }
    return TRUE;
}

integer handleStart(string payload)
{
    list parts = llParseStringKeepNulls(payload, ["|"], []);
    integer n = llGetListLength(parts);
    if (n < 1) return FALSE;
    string kind = llList2String(parts, 0);
    clearState();
    gLive = TRUE;
    if (kind == "solo")
    {
        if (n > 1) gPlayers = (integer)llList2String(parts, 1);
        if (gPlayers < 2) gPlayers = 2;
        if (gPlayers > MAX_SEATS) gPlayers = MAX_SEATS;
        gTurnSeat = 0;
        if (n > 2) gTurnSeat = (integer)llList2String(parts, 2);
        if (n >= 5) takeNames(parts, n - MAX_SEATS);
    }
    else
    {
        gPlayers = MAX_SEATS;
        gTurnSeat = 0;
        if (n >= 5) takeNames(parts, n - MAX_SEATS);
    }
    if (gTurnSeat < 0 || gTurnSeat >= gPlayers) gTurnSeat = 0;
    paintAll();
    llOwnerSay("Canasta display: deal painted (" + kind + ").");
    debug("START " + payload);
    return TRUE;
}

integer handleEvent(string pipe)
{
    list parts = llParseStringKeepNulls(pipe, ["|"], []);
    integer n = llGetListLength(parts);
    if (n < 1) return FALSE;
    string kind = llList2String(parts, 0);
    integer player = 0;
    if (n > 1) player = (integer)llList2String(parts, 1);
    integer team = 0;
    if (n > 2) team = (integer)llList2String(parts, 2);
    integer seat = player - 1;
    if (kind == "NAMES")
    {
        takeNames(parts, 1);
        paintAll();
        return TRUE;
    }
    if (kind == "TURN")
    {
        if (seat >= 0 && seat < MAX_SEATS) gTurnSeat = seat;
        paintAll();
        return TRUE;
    }
    if (kind == "SCORE")
    {
        gScoreA = player;
        gScoreB = team;
        paintAll();
        return TRUE;
    }
    if (kind == "GAME_OVER")
    {
        gTurnSeat = -1;
        paintAll();
        return TRUE;
    }
    debug(pipe);
    return TRUE;
}

default
{
    state_entry()
    {
        clearState();
        llMessageLinked(LINK_SET, 0, "", "fw_reset");
        askForCap();
        applyMoap(TRUE);
        llOwnerSay("Canasta display: Furware text0–text3 + table-top MOAP face " + (string)DISPLAY_FACE + ".");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == DISPLAY_CMD_RESET)
        {
            idleAttract();
            llMessageLinked(LINK_SET, DISPLAY_RSP_RESET_DONE, "", NULL_KEY);
            return;
        }
        if (num == DISPLAY_CMD_START)
        {
            handleStart(str);
            return;
        }
        if (num == DISPLAY_CMD_EVENT)
        {
            handleEvent(str);
            return;
        }
        if (num == DISPLAY_CMD_CAP)
        {
            gSlCap = str;
            applyMoap(FALSE);
            return;
        }
        if ((string)id == "fw_ready")
        {
            paintAll();
            llOwnerSay("Canasta display: Furware ready — painted idle lines.");
        }
    }
}
