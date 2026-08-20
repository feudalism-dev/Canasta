// Canasta — scoreboard ADMIN menus (owner + super-user).
// Drop in the SAME prim as Canasta_Scoreboard.lsl. Compile: Mono.
// Super-user may edit Experience network boards; owner may edit local LSD only.

integer ADMIN_CMD = 93001;
integer ADMIN_RSP = 93002;
key SUPER_USER = "4d4e9fdc-41ae-42c3-bbc9-fc01ce159130";

integer gDlgH = 0;
integer gDlgCh = 0;
key gDlgAv = NULL_KEY;
integer gDlgMode = 0;
string gScope = "L";
string gGame = "c";
string gPeriod = "w";
list gPickUid = [];
list gPickNm = [];
integer gAwaitList = FALSE;

integer isSuper(key av)
{
    return (av == SUPER_USER);
}

integer canAdmin(key av)
{
    if (av == NULL_KEY) return FALSE;
    if (isSuper(av)) return TRUE;
    return (av == llGetOwner());
}

integer canNet(key av)
{
    return isSuper(av);
}

string gameLabel(string game)
{
    if (game == "h") return "Hand&Foot";
    return "Canasta";
}

string periodLabel(string period)
{
    if (period == "w") return "Weekly";
    if (period == "m") return "Monthly";
    if (period == "a") return "All periods";
    return "Lifetime";
}

string cleanName(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["|"], []), " ");
    s = llStringTrim(s, STRING_TRIM);
    if (llStringLength(s) > 18) s = llGetSubString(s, 0, 17);
    if (s == "") s = "Player";
    return s;
}

toCore(string msg, key av)
{
    llMessageLinked(LINK_THIS, ADMIN_CMD, msg, av);
}

integer closeDlg()
{
    if (gDlgH) llListenRemove(gDlgH);
    gDlgH = 0;
    gDlgCh = 0;
    gDlgAv = NULL_KEY;
    gDlgMode = 0;
    gAwaitList = FALSE;
    gPickUid = [];
    gPickNm = [];
    return TRUE;
}

integer openDlg(key av, integer mode, string title, list buttons)
{
    if (gDlgH) llListenRemove(gDlgH);
    gDlgAv = av;
    gDlgMode = mode;
    gDlgCh = 0x80000000 | ((integer)llFrand(0x7FFFFF00) + 1);
    gDlgH = llListen(gDlgCh, "", av, "");
    llDialog(av, title, buttons, gDlgCh);
    return TRUE;
}

integer openText(key av, integer mode, string title)
{
    if (gDlgH) llListenRemove(gDlgH);
    gDlgAv = av;
    gDlgMode = mode;
    gDlgCh = 0x80000000 | ((integer)llFrand(0x7FFFFF00) + 1);
    gDlgH = llListen(gDlgCh, "", av, "");
    llTextBox(av, title, gDlgCh);
    return TRUE;
}

integer showRoot(key av)
{
    list btns = ["Local"];
    if (canNet(av)) btns += ["Network"];
    btns += ["Refresh net", "Cancel"];
    string who = "Owner";
    if (isSuper(av)) who = "Super-user";
    return openDlg(av, 1, "Canasta scores (" + who + ")\nLocal=parlor LSD. Network=Experience (super only).", btns);
}

integer showGame(key av)
{
    string scope = "This parlor";
    if (gScope == "N") scope = "Network";
    return openDlg(av, 2, scope + " — game", ["Canasta", "Hand & Foot", "Back", "Cancel"]);
}

integer showPeriod(key av)
{
    return openDlg(av, 3, gameLabel(gGame) + " — period", ["Weekly", "Monthly", "Lifetime", "All periods", "Back", "Cancel"]);
}

integer showAction(key av)
{
    string scope = "Local";
    if (gScope == "N") scope = "Network";
    return openDlg(av, 4, scope + " · " + gameLabel(gGame) + " · " + periodLabel(gPeriod),
        ["Clear board", "Remove player", "Set score", "Back", "Cancel"]);
}

integer showRemove(key av)
{
    integer n = llGetListLength(gPickNm);
    if (n < 1)
    {
        llRegionSayTo(av, 0, "Canasta admin: no players on that board.");
        return showAction(av);
    }
    list btns = [];
    integer i;
    if (n > 9) n = 9;
    for (i = 0; i < n; i++)
    {
        string label = (string)(i + 1) + ". " + llList2String(gPickNm, i);
        if (llStringLength(label) > 24) label = llGetSubString(label, 0, 23);
        btns += [label];
    }
    btns += ["Back", "Cancel"];
    return openDlg(av, 5, "Remove which player?", btns);
}

integer requestList(key av)
{
    gAwaitList = TRUE;
    toCore("LIST|" + gScope + "|" + gGame + "|" + gPeriod, av);
    llRegionSayTo(av, 0, "Canasta admin: loading board…");
    return TRUE;
}

integer handleDlg(key av, string msg)
{
    if (av != gDlgAv) return FALSE;
    if (msg == "Cancel")
    {
        closeDlg();
        return TRUE;
    }
    if (gDlgMode == 1)
    {
        if (msg == "Local")
        {
            gScope = "L";
            return showGame(av);
        }
        if (msg == "Network")
        {
            if (!canNet(av))
            {
                llRegionSayTo(av, 0, "Canasta admin: only super-user can edit network.");
                return showRoot(av);
            }
            gScope = "N";
            return showGame(av);
        }
        if (msg == "Refresh net")
        {
            toCore("REFRESH", av);
            closeDlg();
            return TRUE;
        }
        return showRoot(av);
    }
    if (gDlgMode == 2)
    {
        if (msg == "Back") return showRoot(av);
        if (msg == "Canasta") gGame = "c";
        else if (msg == "Hand & Foot") gGame = "h";
        else return showGame(av);
        return showPeriod(av);
    }
    if (gDlgMode == 3)
    {
        if (msg == "Back") return showGame(av);
        if (msg == "Weekly") gPeriod = "w";
        else if (msg == "Monthly") gPeriod = "m";
        else if (msg == "Lifetime") gPeriod = "l";
        else if (msg == "All periods") gPeriod = "a";
        else return showPeriod(av);
        return showAction(av);
    }
    if (gDlgMode == 4)
    {
        if (msg == "Back") return showPeriod(av);
        if (msg == "Clear board")
        {
            if (gScope == "N" && !canNet(av)) return closeDlg();
            toCore("CLEAR|" + gScope + "|" + gGame + "|" + gPeriod, av);
            closeDlg();
            return TRUE;
        }
        if (msg == "Remove player") return requestList(av);
        if (msg == "Set score")
        {
            return openText(av, 6, "Set score:\nName|score\nor\nuuid|Name|score\n\n"
                + gameLabel(gGame) + " · " + periodLabel(gPeriod));
        }
        return showAction(av);
    }
    if (gDlgMode == 5)
    {
        if (msg == "Back") return showAction(av);
        integer idx = -1;
        integer i;
        integer n = llGetListLength(gPickNm);
        if (n > 9) n = 9;
        for (i = 0; i < n; i++)
        {
            string label = (string)(i + 1) + ". " + llList2String(gPickNm, i);
            if (llStringLength(label) > 24) label = llGetSubString(label, 0, 23);
            if (msg == label) idx = i;
        }
        if (idx < 0) return showRemove(av);
        if (gScope == "N" && !canNet(av)) return closeDlg();
        toCore("REMOVE|" + gScope + "|" + gGame + "|" + gPeriod + "|" + llList2String(gPickUid, idx), av);
        llRegionSayTo(av, 0, "Canasta admin: remove " + llList2String(gPickNm, idx));
        closeDlg();
        return TRUE;
    }
    if (gDlgMode == 6)
    {
        list parts = llParseStringKeepNulls(msg, ["|"], []);
        integer pn = llGetListLength(parts);
        string uid = "";
        string nm = "";
        integer sc = 0;
        if (pn >= 3)
        {
            uid = llStringTrim(llList2String(parts, 0), STRING_TRIM);
            nm = cleanName(llList2String(parts, 1));
            sc = (integer)llList2String(parts, 2);
        }
        else if (pn >= 2)
        {
            nm = cleanName(llList2String(parts, 0));
            sc = (integer)llList2String(parts, 1);
            uid = llToLower(nm);
        }
        else
        {
            llRegionSayTo(av, 0, "Canasta admin: use Name|score or uuid|Name|score.");
            return showAction(av);
        }
        if (nm == "" || sc < 0)
        {
            llRegionSayTo(av, 0, "Canasta admin: bad Name/score.");
            return showAction(av);
        }
        if (gScope == "N" && !canNet(av)) return closeDlg();
        toCore("FORCE|" + gScope + "|" + gGame + "|" + gPeriod + "|" + (string)sc + "|" + uid + "|" + nm, av);
        llRegionSayTo(av, 0, "Canasta admin: set " + nm + " = " + (string)sc);
        closeDlg();
        return TRUE;
    }
    closeDlg();
    return TRUE;
}

integer takeListRsp(key av, string packed)
{
    gAwaitList = FALSE;
    gPickUid = [];
    gPickNm = [];
    if (packed != "")
    {
        list recs = llParseStringKeepNulls(packed, ["^"], []);
        integer r;
        integer rn = llGetListLength(recs);
        for (r = 0; r < rn; r++)
        {
            list f = llParseStringKeepNulls(llList2String(recs, r), ["~"], []);
            if (llGetListLength(f) >= 3)
            {
                gPickUid += [llList2String(f, 0)];
                gPickNm += [llList2String(f, 1)];
            }
        }
    }
    return showRemove(av);
}

default
{
    state_entry()
    {
        llOwnerSay("Canasta scoreboard admin ready. Free=" + (string)llGetFreeMemory());
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    touch_start(integer n)
    {
        key av = llDetectedKey(0);
        if (!canAdmin(av))
        {
            llRegionSayTo(av, 0, "Canasta scoreboard: owner or super-user only.");
            return;
        }
        showRoot(av);
    }

    listen(integer ch, string name, key id, string msg)
    {
        if (ch == gDlgCh && id == gDlgAv) handleDlg(id, msg);
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num != ADMIN_RSP) return;
        if (llGetSubString(str, 0, 4) == "LIST|")
        {
            if (gAwaitList && id == gDlgAv) takeListRsp(id, llGetSubString(str, 5, -1));
            return;
        }
        if (llGetSubString(str, 0, 2) == "OK|" && id != NULL_KEY)
        {
            llRegionSayTo(id, 0, "Canasta admin: " + llGetSubString(str, 3, -1) + " done.");
        }
    }
}
