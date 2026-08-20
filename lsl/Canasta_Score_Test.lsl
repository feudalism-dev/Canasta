// Canasta — scoreboard test shouter (dev tool).
// Drop on ANY nearby prim (not the scoreboard). Compile: Mono.
// Owner or super-user touch → menu shouts CN_SCORE lines on SCORE_CH
// so you can exercise the parlor board without finishing a real match.
// Stay within 100 m of the scoreboard.

integer SCORE_CH = -18475021;
key SUPER_USER = "4d4e9fdc-41ae-42c3-bbc9-fc01ce159130";

integer gDlgH = 0;
integer gDlgCh = 0;
key gDlgAv = NULL_KEY;
integer gDlgMode = 0;
string gGame = "c";

integer isSuper(key av)
{
    return (av == SUPER_USER);
}

integer canUse(key av)
{
    if (av == NULL_KEY) return FALSE;
    if (isSuper(av)) return TRUE;
    if (av == llGetOwner()) return TRUE;
    return FALSE;
}

string cleanName(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["|"], []), " ");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "'");
    s = llStringTrim(s, STRING_TRIM);
    if (llStringLength(s) > 24) s = llGetSubString(s, 0, 23);
    if (s == "") s = "Player";
    return s;
}

integer closeDlg()
{
    if (gDlgH) llListenRemove(gDlgH);
    gDlgH = 0;
    gDlgCh = 0;
    gDlgAv = NULL_KEY;
    gDlgMode = 0;
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

integer shoutScore(string game, string uid, string nm, integer sc, key tell)
{
    nm = cleanName(nm);
    if (uid == "") uid = llToLower(nm);
    llShout(SCORE_CH, "CN_SCORE|" + game + "|" + uid + "|" + nm + "|" + (string)sc);
    if (tell != NULL_KEY)
    {
        llRegionSayTo(tell, 0, "Shouted " + game + " score " + (string)sc + " for " + nm + " on " + (string)SCORE_CH + ".");
    }
    return TRUE;
}

integer showRoot(key av)
{
    return openDlg(av, 1, "Scoreboard test shouter\nShouts CN_SCORE within 100 m.",
        ["Canasta sample", "H&F sample", "Me · Canasta", "Me · H&F", "Custom…", "Cancel"]);
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
        if (msg == "Canasta sample")
        {
            shoutScore("c", "test-alice", "Test Alice", 5100, av);
            shoutScore("c", "test-bob", "Test Bob", 4200, av);
            closeDlg();
            return TRUE;
        }
        if (msg == "H&F sample")
        {
            shoutScore("h", "test-cara", "Test Cara", 18200, av);
            shoutScore("h", "test-dan", "Test Dan", 15100, av);
            closeDlg();
            return TRUE;
        }
        if (msg == "Me · Canasta")
        {
            gGame = "c";
            return openText(av, 2, "Your Canasta test score (integer):");
        }
        if (msg == "Me · H&F")
        {
            gGame = "h";
            return openText(av, 2, "Your Hand & Foot test score (integer):");
        }
        if (msg == "Custom…")
        {
            return openText(av, 3, "Enter:\ngame|Name|score\nor\ngame|uuid|Name|score\n\ngame = c or h");
        }
        return showRoot(av);
    }
    if (gDlgMode == 2)
    {
        integer sc = (integer)llStringTrim(msg, STRING_TRIM);
        string nm = llGetDisplayName(av);
        if (nm == "") nm = llKey2Name(av);
        shoutScore(gGame, (string)av, nm, sc, av);
        closeDlg();
        return TRUE;
    }
    if (gDlgMode == 3)
    {
        list parts = llParseStringKeepNulls(msg, ["|"], []);
        integer pn = llGetListLength(parts);
        string game = "c";
        string uid = "";
        string nm = "";
        integer sc = 0;
        if (pn >= 4)
        {
            game = llToLower(llStringTrim(llList2String(parts, 0), STRING_TRIM));
            uid = llStringTrim(llList2String(parts, 1), STRING_TRIM);
            nm = llList2String(parts, 2);
            sc = (integer)llList2String(parts, 3);
        }
        else if (pn >= 3)
        {
            game = llToLower(llStringTrim(llList2String(parts, 0), STRING_TRIM));
            nm = llList2String(parts, 1);
            sc = (integer)llList2String(parts, 2);
            uid = llToLower(cleanName(nm));
        }
        else
        {
            llRegionSayTo(av, 0, "Bad format. Use game|Name|score");
            return showRoot(av);
        }
        if (game != "h") game = "c";
        shoutScore(game, uid, nm, sc, av);
        closeDlg();
        return TRUE;
    }
    closeDlg();
    return TRUE;
}

default
{
    state_entry()
    {
        llOwnerSay("Canasta score test: touch for shout menu (channel " + (string)SCORE_CH + ").");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    touch_start(integer n)
    {
        key av = llDetectedKey(0);
        if (!canUse(av))
        {
            llRegionSayTo(av, 0, "Score test: owner or super-user only.");
            return;
        }
        showRoot(av);
    }

    listen(integer ch, string name, key id, string msg)
    {
        if (ch == gDlgCh && id == gDlgAv) handleDlg(id, msg);
    }
}
