// Parlor Hub — shout final scores for a nearby (unlinked) scoreboard.
// Drop in the hub table linkset (root is fine). Compile: Mono.
// Default letter from selected family (LSD cn.fam / DISPLAY_CMD_FAMILY).
// Canasta uses partnership A/B shout; other families are per-seat.
// Channel SCORE_CH must match Canasta_Scoreboard.lsl.
// See Docs/PLAN_PARLOR_HUB.md

integer DISPLAY_CMD_EVENT = 91001;
integer DISPLAY_CMD_START = 91002;
integer DISPLAY_CMD_RESET = 91003;
integer DISPLAY_CMD_FAMILY = 91007;

integer SCORE_CH = -18475021;
integer MAX_SEATS = 4;
string LSD_FAM = "cn.fam";

list gName = [];
list gAv = [];
integer gPlayers = 4;
list gScore = [];
string gGame = "c";
string gFamily = "";
integer gPartnership = FALSE;

string cleanName(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "'");
    s = llDumpList2String(llParseStringKeepNulls(s, ["|"], []), " ");
    s = llStringTrim(s, STRING_TRIM);
    if (llStringLength(s) > 24) s = llGetSubString(s, 0, 23);
    if (s == "") s = "Player";
    return s;
}

string normFamily(string raw)
{
    raw = llToLower(llStringTrim(raw, STRING_TRIM));
    if (raw == "canasta") return "canasta";
    if (raw == "rummy") return "rummy";
    if (raw == "trick") return "trick";
    if (raw == "ichi") return "ichi";
    if (raw == "skippo") return "skippo";
    if (raw == "phaseit" || raw == "phase_it" || raw == "phase-it") return "phaseit";
    if (raw == "yotsy" || raw == "yahtzee") return "yotsy";
    if (raw == "rowshambo" || raw == "rsb" || raw == "row-sham-bo" || raw == "row_sham_bo") return "rowshambo";
    return "";
}

string letterForFamily(string fam)
{
    if (fam == "rummy") return "r";
    if (fam == "trick") return "t";
    if (fam == "ichi") return "i";
    if (fam == "skippo") return "o";
    if (fam == "phaseit") return "p";
    if (fam == "yotsy") return "y";
    if (fam == "rowshambo") return "w";
    return "c";
}

string normGame(string g)
{
    g = llToLower(llStringTrim(g, STRING_TRIM));
    integer i;
    integer n = llStringLength(g);
    string ok = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (i = 0; i < n; i++)
    {
        string ch = llGetSubString(g, i, i);
        if (llSubStringIndex(ok, ch) >= 0) return ch;
    }
    return letterForFamily(gFamily);
}

applyFamily(string fam)
{
    gFamily = normFamily(fam);
    gPartnership = (gFamily == "canasta");
    gGame = letterForFamily(gFamily);
    llLinksetDataWrite(LSD_FAM, gFamily);
}

integer clearState()
{
    gName = ["", "", "", ""];
    gAv = [NULL_KEY, NULL_KEY, NULL_KEY, NULL_KEY];
    gPlayers = 4;
    gScore = [0, 0, 0, 0];
    gGame = letterForFamily(gFamily);
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
        integer sc = 0;
        if (gPartnership)
        {
            sc = llList2Integer(gScore, 1);
            if (i % 2 == 0) sc = llList2Integer(gScore, 0);
        }
        else if (i < llGetListLength(gScore))
        {
            sc = llList2Integer(gScore, i);
        }
        llShout(SCORE_CH, "CN_SCORE|" + gGame + "|" + (string)av + "|" + nm + "|" + (string)sc);
        @nextseat;
    }
    return TRUE;
}

integer handleEvent(string pipe)
{
    list parts = llParseStringKeepNulls(pipe, ["|"], []);
    integer n = llGetListLength(parts);
    if (n < 1) return FALSE;
    string kind = llList2String(parts, 0);
    if (kind == "NAMES")
    {
        takeNames(parts, 1);
        return TRUE;
    }
    if (kind == "SCORE")
    {
        // Per-seat: SCORE|s0|s1|s2|s3 — partnership: SCORE|A|B
        if (n >= 5)
        {
            integer i;
            for (i = 0; i < MAX_SEATS; i++)
            {
                integer sc = 0;
                integer idx = 1 + i;
                if (idx < n) sc = (integer)llList2String(parts, idx);
                gScore = llListReplaceList(gScore, [sc], i, i);
            }
        }
        else
        {
            integer a = 0;
            integer b = 0;
            if (n > 1) a = (integer)llList2String(parts, 1);
            if (n > 2) b = (integer)llList2String(parts, 2);
            gScore = [a, b, a, b];
            gPartnership = TRUE;
        }
        return TRUE;
    }
    if (kind == "GAME_OVER")
    {
        if (n > 5) gGame = normGame(llList2String(parts, 5));
        shoutFinal();
        return TRUE;
    }
    return TRUE;
}

default
{
    state_entry()
    {
        applyFamily(llLinksetDataRead(LSD_FAM));
        clearState();
        llOwnerSay("Parlor scores: llShout CN_SCORE on " + (string)SCORE_CH + ".");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER)
        {
            applyFamily("");
            llResetScript();
        }
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == DISPLAY_CMD_FAMILY)
        {
            applyFamily(str);
            return;
        }
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
