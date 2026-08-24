// Canasta — shout final scores for a nearby (unlinked) scoreboard.
// Drop in the table linkset (root is fine). Compile: Mono.
// On GAME_OVER, llShout (100 m): CN_SCORE|c|uuid|Name|8441  (c=Canasta, h=Hand&Foot)
// Channel SCORE_CH must match Canasta_Scoreboard.lsl.

integer DISPLAY_CMD_EVENT = 91001;
integer DISPLAY_CMD_START = 91002;
integer DISPLAY_CMD_RESET = 91003;

integer SCORE_CH = -18475021;
integer MAX_SEATS = 4;

list gName = [];
list gAv = [];
integer gPlayers = 4;
integer gScoreA = 0;
integer gScoreB = 0;
string gGame = "c";

string cleanName(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "'");
    s = llDumpList2String(llParseStringKeepNulls(s, ["|"], []), " ");
    s = llStringTrim(s, STRING_TRIM);
    if (llStringLength(s) > 24) s = llGetSubString(s, 0, 23);
    if (s == "") s = "Player";
    return s;
}

string normGame(string g)
{
    g = llToLower(llStringTrim(g, STRING_TRIM));
    if (g == "h" || g == "hf" || g == "hand" || g == "handandfoot") return "h";
    if (g == "s" || g == "samba") return "s";
    if (g == "b" || g == "bolivia") return "b";
    return "c";
}

integer clearState()
{
    gName = ["", "", "", ""];
    gAv = [NULL_KEY, NULL_KEY, NULL_KEY, NULL_KEY];
    gPlayers = 4;
    gScoreA = 0;
    gScoreB = 0;
    gGame = "c";
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

integer takeAvatars(list parts, integer startAt)
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        key av = NULL_KEY;
        integer idx = startAt + i;
        if (idx < llGetListLength(parts))
        {
            string raw = llStringTrim(llList2String(parts, idx), STRING_TRIM);
            if (raw != "") av = (key)raw;
        }
        gAv = llListReplaceList(gAv, [av], i, i);
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
    if (kind == "solo")
    {
        if (n > 1) gPlayers = (integer)llList2String(parts, 1);
        if (gPlayers < 2) gPlayers = 2;
        if (gPlayers > MAX_SEATS) gPlayers = MAX_SEATS;
        if (n >= 3 + MAX_SEATS * 2)
        {
            takeAvatars(parts, 3);
            takeNames(parts, 3 + MAX_SEATS);
        }
        else if (n >= 5) takeNames(parts, n - MAX_SEATS);
    }
    else
    {
        gPlayers = MAX_SEATS;
        if (n >= 1 + MAX_SEATS * 2)
        {
            takeAvatars(parts, 1);
            takeNames(parts, 1 + MAX_SEATS);
        }
        else if (n >= 5) takeNames(parts, n - MAX_SEATS);
    }
    return TRUE;
}

integer shoutFinal()
{
    integer i;
    for (i = 0; i < gPlayers; i++)
    {
        if (i >= MAX_SEATS) return TRUE;
        key av = llList2Key(gAv, i);
        if (av == NULL_KEY) jump nextseat;
        string nm = llGetDisplayName(av);
        if (nm == "") nm = llKey2Name(av);
        if (nm == "") nm = llList2String(gName, i);
        nm = cleanName(nm);
        integer sc = gScoreB;
        if (i % 2 == 0) sc = gScoreA;
        llShout(SCORE_CH, "CN_SCORE|" + gGame + "|" + (string)av + "|" + nm + "|" + (string)sc);
        @nextseat;
    }
    return TRUE;
}

integer handleEvent(string pipe)
{
    list parts = llParseStringKeepNulls(pipe, ["|"], []);
    if (llGetListLength(parts) < 1) return FALSE;
    string kind = llList2String(parts, 0);
    if (kind == "NAMES")
    {
        takeNames(parts, 1);
        return TRUE;
    }
    if (kind == "SCORE")
    {
        if (llGetListLength(parts) > 1) gScoreA = (integer)llList2String(parts, 1);
        if (llGetListLength(parts) > 2) gScoreB = (integer)llList2String(parts, 2);
        return TRUE;
    }
    if (kind == "GAME_OVER")
    {
        if (llGetListLength(parts) > 5) gGame = normGame(llList2String(parts, 5));
        shoutFinal();
        return TRUE;
    }
    return TRUE;
}

default
{
    state_entry()
    {
        clearState();
        llOwnerSay("Canasta scores: llShout CN_SCORE on " + (string)SCORE_CH + ".");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == DISPLAY_CMD_RESET)
        {
            clearState();
            return;
        }
        if (num == DISPLAY_CMD_START)
        {
            handleStart(str);
            return;
        }
        if (num == DISPLAY_CMD_EVENT) handleEvent(str);
    }
}
