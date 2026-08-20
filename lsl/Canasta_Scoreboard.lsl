// Canasta — parlor scoreboard (LSD local + Experience network + MOAP UI).
// Drop this script on its OWN object (not the game table). Compile: Mono + same Experience as the table.
// Media face 0 shows GitHub Pages ?view=scores. No Furware. Tabs are on the web page.
// Listens for llShout from Canasta_Scores.lsl: CN_SCORE|c|uuid|Name|8441  (c=Canasta, h=Hand&Foot)
// Touch (owner or super-user) opens admin menus. Super-user alone may write Experience keys.

integer SCORE_CH = -18475021;
integer MEDIA_FACE = 0;
integer MEDIA_PIXELS = 1024;
integer PAGE_ASSET_REV = 2;
string WEB_URL = "https://feudalism-dev.github.io/Canasta/";
float TIMER_SEC = 12.0;
key SUPER_USER = "4d4e9fdc-41ae-42c3-bbc9-fc01ce159130";

integer gListen = 0;
string gCapUrl = "";
string gLastHome = "";
integer gMoapPending = FALSE;
integer gMoapKick = 0;
string gNetCW = "";
string gNetCM = "";
string gNetCL = "";
string gNetHW = "";
string gNetHM = "";
string gNetHL = "";
string gInUid = "";
string gInName = "";
integer gInScore = 0;
list gXpQ = [];
string gXpOp = "";
integer gXpStep = 0;
key gXpReq = NULL_KEY;
integer gXpSaid = FALSE;

integer gDlgH = 0;
integer gDlgCh = 0;
key gDlgAv = NULL_KEY;
integer gDlgMode = 0;
string gAdScope = "L";
string gAdGame = "c";
string gAdPeriod = "w";
list gPickUid = [];
list gPickNm = [];

string jsonEscape(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
}

string cleanName(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["~"], []), " ");
    s = llDumpList2String(llParseStringKeepNulls(s, ["^"], []), " ");
    s = llDumpList2String(llParseStringKeepNulls(s, ["|"], []), " ");
    s = llDumpList2String(llParseStringKeepNulls(s, [","], []), " ");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "'");
    s = llStringTrim(s, STRING_TRIM);
    if (llStringLength(s) > 18) s = llGetSubString(s, 0, 17);
    if (s == "") s = "Player";
    return s;
}

string normGame(string g)
{
    g = llToLower(llStringTrim(g, STRING_TRIM));
    if (g == "h" || g == "hf" || g == "hand" || g == "handandfoot") return "h";
    return "c";
}

string weekId()
{
    integer days = llGetUnixTime() / 86400;
    return "w" + (string)((days + 3) / 7);
}

string monthId()
{
    return llGetSubString(llGetTimestamp(), 0, 6);
}

string xpKey(string game, string period)
{
    if (period == "w") return "cn.sc." + game + ".w." + weekId();
    if (period == "m") return "cn.sc." + game + ".m." + monthId();
    return "cn.sc." + game + ".l";
}

string lsdKey(string game, string period)
{
    return "l" + game + period;
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

integer isSuper(key av)
{
    return (av == SUPER_USER);
}

integer canAdmin(key av)
{
    if (av == NULL_KEY) return FALSE;
    if (isSuper(av)) return TRUE;
    if (av == llGetOwner()) return TRUE;
    return FALSE;
}

integer canNetAdmin(key av)
{
    return isSuper(av);
}

integer hasXp()
{
    return (llGetListLength(llGetExperienceDetails(NULL_KEY)) > 0);
}

string packRows(list uids, list nms, list scs)
{
    integer n = llGetListLength(uids);
    integer a;
    integer b;
    for (a = 0; a < n; a++)
    {
        for (b = 0; b < n - 1; b++)
        {
            if (llList2Integer(scs, b) < llList2Integer(scs, b + 1))
            {
                integer ts = llList2Integer(scs, b);
                string tu = llList2String(uids, b);
                string tn = llList2String(nms, b);
                scs = llListReplaceList(scs, [llList2Integer(scs, b + 1)], b, b);
                uids = llListReplaceList(uids, [llList2String(uids, b + 1)], b, b);
                nms = llListReplaceList(nms, [llList2String(nms, b + 1)], b, b);
                scs = llListReplaceList(scs, [ts], b + 1, b + 1);
                uids = llListReplaceList(uids, [tu], b + 1, b + 1);
                nms = llListReplaceList(nms, [tn], b + 1, b + 1);
            }
        }
    }
    if (n > 10) n = 10;
    string out = "";
    integer i;
    for (i = 0; i < n; i++)
    {
        if (i) out += "^";
        out += llList2String(uids, i) + "~" + llList2String(nms, i) + "~" + (string)llList2Integer(scs, i);
    }
    return out;
}

list unpackUids(string packed)
{
    list uids = [];
    if (packed == "") return uids;
    list recs = llParseStringKeepNulls(packed, ["^"], []);
    integer r;
    integer rn = llGetListLength(recs);
    for (r = 0; r < rn; r++)
    {
        list f = llParseStringKeepNulls(llList2String(recs, r), ["~"], []);
        if (llGetListLength(f) >= 3) uids += [llList2String(f, 0)];
    }
    return uids;
}

list unpackNms(string packed)
{
    list nms = [];
    if (packed == "") return nms;
    list recs = llParseStringKeepNulls(packed, ["^"], []);
    integer r;
    integer rn = llGetListLength(recs);
    for (r = 0; r < rn; r++)
    {
        list f = llParseStringKeepNulls(llList2String(recs, r), ["~"], []);
        if (llGetListLength(f) >= 3) nms += [llList2String(f, 1)];
    }
    return nms;
}

list unpackScs(string packed)
{
    list scs = [];
    if (packed == "") return scs;
    list recs = llParseStringKeepNulls(packed, ["^"], []);
    integer r;
    integer rn = llGetListLength(recs);
    for (r = 0; r < rn; r++)
    {
        list f = llParseStringKeepNulls(llList2String(recs, r), ["~"], []);
        if (llGetListLength(f) >= 3) scs += [(integer)llList2String(f, 2)];
    }
    return scs;
}

string insertPacked(string packed, string uid, string nm, integer score)
{
    if (uid == "" || uid == (string)NULL_KEY) return packed;
    list uids = unpackUids(packed);
    list nms = unpackNms(packed);
    list scs = unpackScs(packed);
    integer found = -1;
    integer i;
    integer n = llGetListLength(uids);
    for (i = 0; i < n; i++)
    {
        if (llList2String(uids, i) == uid) found = i;
    }
    if (found >= 0)
    {
        nms = llListReplaceList(nms, [nm], found, found);
        if (score > llList2Integer(scs, found)) scs = llListReplaceList(scs, [score], found, found);
    }
    else
    {
        uids += [uid];
        nms += [nm];
        scs += [score];
    }
    return packRows(uids, nms, scs);
}

string forceSetPacked(string packed, string uid, string nm, integer score)
{
    if (uid == "" || uid == (string)NULL_KEY) return packed;
    list uids = unpackUids(packed);
    list nms = unpackNms(packed);
    list scs = unpackScs(packed);
    integer found = -1;
    integer i;
    integer n = llGetListLength(uids);
    for (i = 0; i < n; i++)
    {
        if (llList2String(uids, i) == uid) found = i;
    }
    if (found >= 0)
    {
        nms = llListReplaceList(nms, [nm], found, found);
        scs = llListReplaceList(scs, [score], found, found);
    }
    else
    {
        uids += [uid];
        nms += [nm];
        scs += [score];
    }
    return packRows(uids, nms, scs);
}

string removePacked(string packed, string uid)
{
    if (uid == "") return packed;
    list uids = unpackUids(packed);
    list nms = unpackNms(packed);
    list scs = unpackScs(packed);
    integer found = -1;
    integer i;
    integer n = llGetListLength(uids);
    for (i = 0; i < n; i++)
    {
        if (llList2String(uids, i) == uid) found = i;
    }
    if (found < 0) return packed;
    uids = llDeleteSubList(uids, found, found);
    nms = llDeleteSubList(nms, found, found);
    scs = llDeleteSubList(scs, found, found);
    return packRows(uids, nms, scs);
}

string rowsToJson(string packed)
{
    if (packed == "") return "[]";
    list recs = llParseStringKeepNulls(packed, ["^"], []);
    string json = "[";
    integer i;
    integer n = llGetListLength(recs);
    integer wrote = 0;
    for (i = 0; i < n; i++)
    {
        list f = llParseStringKeepNulls(llList2String(recs, i), ["~"], []);
        if (llGetListLength(f) < 3) jump skiprow;
        if (wrote) json += ",";
        json += "{\"u\":\"" + jsonEscape(llList2String(f, 0))
            + "\",\"n\":\"" + jsonEscape(llList2String(f, 1))
            + "\",\"s\":" + llList2String(f, 2) + "}";
        wrote += 1;
        @skiprow;
    }
    return json + "]";
}

integer rotateLocal()
{
    string wk = weekId();
    string mk = monthId();
    if (llLinksetDataRead("lwk") != wk)
    {
        llLinksetDataWrite("lcw", "");
        llLinksetDataWrite("lhw", "");
        llLinksetDataWrite("lwk", wk);
    }
    if (llLinksetDataRead("lmk") != mk)
    {
        llLinksetDataWrite("lcm", "");
        llLinksetDataWrite("lhm", "");
        llLinksetDataWrite("lmk", mk);
    }
    return TRUE;
}

string bundleJson(string game)
{
    return "{\"w\":" + rowsToJson(llLinksetDataRead(lsdKey(game, "w")))
        + ",\"m\":" + rowsToJson(llLinksetDataRead(lsdKey(game, "m")))
        + ",\"l\":" + rowsToJson(llLinksetDataRead(lsdKey(game, "l")))
        + "}";
}

string netBundleJson(string game)
{
    string w = gNetCW;
    string m = gNetCM;
    string l = gNetCL;
    if (game == "h")
    {
        w = gNetHW;
        m = gNetHM;
        l = gNetHL;
    }
    return "{\"w\":" + rowsToJson(w)
        + ",\"m\":" + rowsToJson(m)
        + ",\"l\":" + rowsToJson(l)
        + "}";
}

string scoresJson()
{
    rotateLocal();
    return "{\"ok\":true,\"week\":\"" + weekId()
        + "\",\"month\":\"" + monthId()
        + "\",\"local\":{\"c\":" + bundleJson("c")
        + ",\"h\":" + bundleJson("h")
        + "},\"net\":{\"c\":" + netBundleJson("c")
        + ",\"h\":" + netBundleJson("h")
        + "}}";
}

integer saveLocalPeriod(string game, string period, string packed)
{
    llLinksetDataWrite(lsdKey(game, period), packed);
    return TRUE;
}

string loadLocalPeriod(string game, string period)
{
    return llLinksetDataRead(lsdKey(game, period));
}

string loadNetPeriod(string game, string period)
{
    if (game == "h")
    {
        if (period == "w") return gNetHW;
        if (period == "m") return gNetHM;
        return gNetHL;
    }
    if (period == "w") return gNetCW;
    if (period == "m") return gNetCM;
    return gNetCL;
}

integer setNetCache(string game, string period, string packed)
{
    if (game == "h")
    {
        if (period == "w") gNetHW = packed;
        else if (period == "m") gNetHM = packed;
        else gNetHL = packed;
        return TRUE;
    }
    if (period == "w") gNetCW = packed;
    else if (period == "m") gNetCM = packed;
    else gNetCL = packed;
    return TRUE;
}

integer enqueueXp(string op, string uid, string nm, integer score)
{
    if (llListFindList(gXpQ, [op, uid, nm, score]) >= 0) return FALSE;
    if (gXpOp == op && gInUid == uid && gInName == nm && gInScore == score) return FALSE;
    gXpQ += [op, uid, nm, score];
    return TRUE;
}

integer enqueueReads()
{
    enqueueXp("Rcw", "", "", 0);
    enqueueXp("Rcm", "", "", 0);
    enqueueXp("Rcl", "", "", 0);
    enqueueXp("Rhw", "", "", 0);
    enqueueXp("Rhm", "", "", 0);
    enqueueXp("Rhl", "", "", 0);
    return TRUE;
}

integer kickXp()
{
    if (!hasXp())
    {
        if (!gXpSaid)
        {
            gXpSaid = TRUE;
            llOwnerSay("Canasta scoreboard: compile with the table Experience for networked scores.");
        }
        return FALSE;
    }
    if (gXpReq != NULL_KEY) return FALSE;
    if (gXpOp == "" && llGetListLength(gXpQ) >= 4)
    {
        gXpOp = llList2String(gXpQ, 0);
        gInUid = llList2String(gXpQ, 1);
        gInName = llList2String(gXpQ, 2);
        gInScore = llList2Integer(gXpQ, 3);
        gXpQ = llDeleteSubList(gXpQ, 0, 3);
        gXpStep = 0;
    }
    if (gXpOp == "") return FALSE;
    string game = llGetSubString(gXpOp, 1, 1);
    string period = llGetSubString(gXpOp, 2, 2);
    gXpReq = llReadKeyValue(xpKey(game, period));
    return TRUE;
}

integer ingest(string game, string uid, string nm, integer score)
{
    game = normGame(game);
    rotateLocal();
    string who = uid;
    string label = cleanName(nm);
    saveLocalPeriod(game, "w", insertPacked(loadLocalPeriod(game, "w"), who, label, score));
    saveLocalPeriod(game, "m", insertPacked(loadLocalPeriod(game, "m"), who, label, score));
    saveLocalPeriod(game, "l", insertPacked(loadLocalPeriod(game, "l"), who, label, score));
    enqueueXp("M" + game + "w", who, label, score);
    enqueueXp("M" + game + "m", who, label, score);
    enqueueXp("M" + game + "l", who, label, score);
    kickXp();
    return TRUE;
}

list periodList(string period)
{
    if (period == "a") return ["w", "m", "l"];
    return [period];
}

integer adminClearLocal(string game, string period)
{
    list ps = periodList(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        saveLocalPeriod(game, llList2String(ps, i), "");
    }
    return TRUE;
}

integer adminForceLocal(string game, string period, string uid, string nm, integer score)
{
    list ps = periodList(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        string p = llList2String(ps, i);
        saveLocalPeriod(game, p, forceSetPacked(loadLocalPeriod(game, p), uid, nm, score));
    }
    return TRUE;
}

integer adminRemoveLocal(string game, string period, string uid)
{
    list ps = periodList(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        string p = llList2String(ps, i);
        saveLocalPeriod(game, p, removePacked(loadLocalPeriod(game, p), uid));
    }
    return TRUE;
}

integer adminClearNet(string game, string period)
{
    list ps = periodList(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        enqueueXp("Z" + game + llList2String(ps, i), "", "", 0);
    }
    kickXp();
    return TRUE;
}

integer adminForceNet(string game, string period, string uid, string nm, integer score)
{
    list ps = periodList(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        enqueueXp("F" + game + llList2String(ps, i), uid, nm, score);
    }
    kickXp();
    return TRUE;
}

integer adminRemoveNet(string game, string period, string uid)
{
    list ps = periodList(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        enqueueXp("D" + game + llList2String(ps, i), uid, "", 0);
    }
    kickXp();
    return TRUE;
}

string boardPackedForPick()
{
    string period = gAdPeriod;
    if (period == "a") period = "l";
    if (gAdScope == "N") return loadNetPeriod(gAdGame, period);
    return loadLocalPeriod(gAdGame, period);
}

integer closeDlg()
{
    if (gDlgH) llListenRemove(gDlgH);
    gDlgH = 0;
    gDlgCh = 0;
    gDlgAv = NULL_KEY;
    gDlgMode = 0;
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
    if (canNetAdmin(av)) btns += ["Network"];
    btns += ["Refresh net", "Cancel"];
    string who = "Owner";
    if (isSuper(av)) who = "Super-user";
    return openDlg(av, 1, "Canasta scores (" + who + ")\nLocal = this parlor LSD.\nNetwork = Experience (super only).", btns);
}

integer showGame(key av)
{
    string scope = "This parlor";
    if (gAdScope == "N") scope = "Network";
    return openDlg(av, 2, scope + " — pick game", ["Canasta", "Hand & Foot", "Back", "Cancel"]);
}

integer showPeriod(key av)
{
    return openDlg(av, 3, gameLabel(gAdGame) + " — pick period", ["Weekly", "Monthly", "Lifetime", "All periods", "Back", "Cancel"]);
}

integer showAction(key av)
{
    string scope = "Local";
    if (gAdScope == "N") scope = "Network";
    string t = scope + " · " + gameLabel(gAdGame) + " · " + periodLabel(gAdPeriod);
    return openDlg(av, 4, t + "\nClear / Remove / Set score", ["Clear board", "Remove player", "Set score", "Back", "Cancel"]);
}

integer showRemove(key av)
{
    string packed = boardPackedForPick();
    gPickUid = unpackUids(packed);
    gPickNm = unpackNms(packed);
    integer n = llGetListLength(gPickNm);
    if (n < 1)
    {
        llRegionSayTo(av, 0, "Canasta scoreboard: no players on that board.");
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

list parseQuery(string qs)
{
    list out = [];
    list pairs = llParseString2List(qs, ["&"], []);
    integer i;
    integer n = llGetListLength(pairs);
    for (i = 0; i < n; i++)
    {
        string pair = llList2String(pairs, i);
        integer eq = llSubStringIndex(pair, "=");
        if (eq >= 0)
        {
            out += [
                llUnescapeURL(llGetSubString(pair, 0, eq - 1)),
                llDumpList2String(llParseStringKeepNulls(llUnescapeURL(llGetSubString(pair, eq + 1, -1)), ["+"], []), " ")
            ];
        }
    }
    return out;
}

string qget(list params, string name)
{
    integer idx = llListFindList(params, [name]);
    if (idx < 0) return "";
    return llList2String(params, idx + 1);
}

integer cbOk(string cb)
{
    if (cb == "" || llStringLength(cb) > 64) return FALSE;
    return TRUE;
}

sendJsonp(key httpId, string callback, string json)
{
    if (httpId == NULL_KEY) return;
    if (!cbOk(callback))
    {
        llSetContentType(httpId, CONTENT_TYPE_TEXT);
        llHTTPResponse(httpId, 400, "{\"ok\":false}");
        return;
    }
    llSetContentType(httpId, CONTENT_TYPE_TEXT);
    llHTTPResponse(httpId, 200, callback + "(" + json + ");");
}

string sessionHome()
{
    string home = WEB_URL
        + "?view=scores"
        + "&uid=board"
        + "&rev=" + (string)PAGE_ASSET_REV;
    if (gCapUrl != "") home += "&sl_cap=" + llEscapeURL(gCapUrl);
    return home;
}

integer applyMoap(integer force)
{
    string home = sessionHome();
    if (!force && home != "" && home == gLastHome) return FALSE;
    string cur = home;
    if (force) cur = home + "&cb=" + (string)llGetUnixTime();
    llSetPrimMediaParams(MEDIA_FACE, [
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_CURRENT_URL, cur,
        PRIM_MEDIA_HOME_URL, home,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, MEDIA_PIXELS,
        PRIM_MEDIA_HEIGHT_PIXELS, MEDIA_PIXELS,
        PRIM_MEDIA_WHITELIST_ENABLE, FALSE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE
    ]);
    gLastHome = home;
    return TRUE;
}

integer takeScoreChat(string msg)
{
    string uid = "";
    string nm = "";
    integer sc = 0;
    string game = "c";
    if (llGetSubString(msg, 0, 8) == "CN_SCORE|")
    {
        list parts = llParseStringKeepNulls(msg, ["|"], []);
        if (llGetListLength(parts) < 5) return FALSE;
        game = normGame(llList2String(parts, 1));
        uid = llList2String(parts, 2);
        nm = llList2String(parts, 3);
        sc = (integer)llList2String(parts, 4);
        if (nm == "") return FALSE;
        if (uid == "") uid = llToLower(nm);
        ingest(game, uid, nm, sc);
        return TRUE;
    }
    integer p = llSubStringIndex(msg, "player:=\"");
    if (p < 0) return FALSE;
    integer start = p + 9;
    string rest = llGetSubString(msg, start, -1);
    integer q = llSubStringIndex(rest, "\"");
    if (q < 0) return FALSE;
    nm = llGetSubString(rest, 0, q - 1);
    integer s = llSubStringIndex(llToLower(msg), "score=");
    if (s < 0) return FALSE;
    sc = (integer)llGetSubString(msg, s + 6, -1);
    integer g = llSubStringIndex(llToLower(msg), "game=");
    if (g >= 0) game = normGame(llGetSubString(msg, g + 5, -1));
    nm = llStringTrim(nm, STRING_TRIM);
    if (nm == "") return FALSE;
    uid = llToLower(nm);
    ingest(game, uid, nm, sc);
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
            gAdScope = "L";
            return showGame(av);
        }
        if (msg == "Network")
        {
            if (!canNetAdmin(av))
            {
                llRegionSayTo(av, 0, "Canasta scoreboard: only the super-user can edit network scores.");
                return showRoot(av);
            }
            gAdScope = "N";
            return showGame(av);
        }
        if (msg == "Refresh net")
        {
            enqueueReads();
            kickXp();
            llRegionSayTo(av, 0, "Canasta scoreboard: refreshing network cache.");
            closeDlg();
            return TRUE;
        }
        return showRoot(av);
    }
    if (gDlgMode == 2)
    {
        if (msg == "Back") return showRoot(av);
        if (msg == "Canasta") gAdGame = "c";
        else if (msg == "Hand & Foot") gAdGame = "h";
        else return showGame(av);
        return showPeriod(av);
    }
    if (gDlgMode == 3)
    {
        if (msg == "Back") return showGame(av);
        if (msg == "Weekly") gAdPeriod = "w";
        else if (msg == "Monthly") gAdPeriod = "m";
        else if (msg == "Lifetime") gAdPeriod = "l";
        else if (msg == "All periods") gAdPeriod = "a";
        else return showPeriod(av);
        return showAction(av);
    }
    if (gDlgMode == 4)
    {
        if (msg == "Back") return showPeriod(av);
        if (msg == "Clear board")
        {
            if (gAdScope == "N")
            {
                if (!canNetAdmin(av)) return closeDlg();
                adminClearNet(gAdGame, gAdPeriod);
                llRegionSayTo(av, 0, "Canasta scoreboard: network clear queued (" + gameLabel(gAdGame) + " / " + periodLabel(gAdPeriod) + ").");
            }
            else
            {
                adminClearLocal(gAdGame, gAdPeriod);
                llRegionSayTo(av, 0, "Canasta scoreboard: local board cleared (" + gameLabel(gAdGame) + " / " + periodLabel(gAdPeriod) + ").");
            }
            closeDlg();
            return TRUE;
        }
        if (msg == "Remove player") return showRemove(av);
        if (msg == "Set score")
        {
            return openText(av, 6, "Set score — enter:\nName|score\nor\nuuid|Name|score\n\n" + gameLabel(gAdGame) + " · " + periodLabel(gAdPeriod));
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
        string uid = llList2String(gPickUid, idx);
        string nm = llList2String(gPickNm, idx);
        if (gAdScope == "N")
        {
            if (!canNetAdmin(av)) return closeDlg();
            adminRemoveNet(gAdGame, gAdPeriod, uid);
            llRegionSayTo(av, 0, "Canasta scoreboard: network remove queued for " + nm + ".");
        }
        else
        {
            adminRemoveLocal(gAdGame, gAdPeriod, uid);
            llRegionSayTo(av, 0, "Canasta scoreboard: removed " + nm + " from local board.");
        }
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
            llRegionSayTo(av, 0, "Canasta scoreboard: use Name|score or uuid|Name|score.");
            return showAction(av);
        }
        if (nm == "" || sc < 0)
        {
            llRegionSayTo(av, 0, "Canasta scoreboard: bad Name/score.");
            return showAction(av);
        }
        if (gAdScope == "N")
        {
            if (!canNetAdmin(av)) return closeDlg();
            adminForceNet(gAdGame, gAdPeriod, uid, nm, sc);
            llRegionSayTo(av, 0, "Canasta scoreboard: network set queued for " + nm + " = " + (string)sc + ".");
        }
        else
        {
            adminForceLocal(gAdGame, gAdPeriod, uid, nm, sc);
            llRegionSayTo(av, 0, "Canasta scoreboard: local set " + nm + " = " + (string)sc + ".");
        }
        closeDlg();
        return TRUE;
    }
    closeDlg();
    return TRUE;
}

string applyWriteOp(string kind, string base)
{
    if (kind == "Z") return "";
    if (kind == "D") return removePacked(base, gInUid);
    if (kind == "F") return forceSetPacked(base, gInUid, gInName, gInScore);
    return insertPacked(base, gInUid, gInName, gInScore);
}

default
{
    state_entry()
    {
        rotateLocal();
        gListen = llListen(SCORE_CH, "", NULL_KEY, "");
        llRequestSecureURL();
        enqueueReads();
        kickXp();
        gMoapPending = TRUE;
        gMoapKick = 1;
        llSetTimerEvent(0.5);
        llOwnerSay("Canasta scoreboard: MOAP face " + (string)MEDIA_FACE + ", listen " + (string)SCORE_CH + ". Touch to admin.");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION_START) llRequestSecureURL();
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

    timer()
    {
        if (gMoapPending)
        {
            gMoapPending = FALSE;
            applyMoap(TRUE);
            if (gMoapKick > 0)
            {
                gMoapKick = 0;
                gMoapPending = TRUE;
                llSetTimerEvent(1.5);
                return;
            }
            llSetTimerEvent(TIMER_SEC);
        }
        if (gXpOp == "" && llGetListLength(gXpQ) == 0) enqueueReads();
        kickXp();
    }

    listen(integer ch, string name, key id, string msg)
    {
        if (ch == SCORE_CH)
        {
            takeScoreChat(msg);
            return;
        }
        if (ch == gDlgCh && id == gDlgAv) handleDlg(id, msg);
    }

    http_request(key id, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            gCapUrl = body;
            gMoapPending = TRUE;
            gMoapKick = 1;
            llSetTimerEvent(0.5);
            llOwnerSay("Canasta scoreboard: HTTP-IN ready.");
            return;
        }
        if (method == URL_REQUEST_DENIED)
        {
            llOwnerSay("Canasta scoreboard: HTTP-IN denied.");
            return;
        }
        string qs = llGetHTTPHeader(id, "x-query-string");
        list q = parseQuery(qs);
        string action = qget(q, "action");
        string cb = qget(q, "cb");
        if (action == "refresh")
        {
            enqueueReads();
            kickXp();
        }
        sendJsonp(id, cb, scoresJson());
    }

    dataserver(key query, string data)
    {
        if (query != gXpReq) return;
        gXpReq = NULL_KEY;
        list res = llCSV2List(data);
        integer ok = FALSE;
        if (llGetListLength(res) > 0) ok = (integer)llList2String(res, 0);
        string payload = "";
        integer err = 0;
        if (ok && llGetListLength(res) > 1) payload = llList2String(res, 1);
        if (!ok && llGetListLength(res) > 1) err = (integer)llList2String(res, 1);
        string kind = llGetSubString(gXpOp, 0, 0);
        string game = llGetSubString(gXpOp, 1, 1);
        string period = llGetSubString(gXpOp, 2, 2);
        if (kind == "R")
        {
            if (ok) setNetCache(game, period, payload);
            gXpOp = "";
            gXpStep = 0;
            kickXp();
            return;
        }
        if (kind != "M" && kind != "F" && kind != "D" && kind != "Z")
        {
            gXpOp = "";
            kickXp();
            return;
        }
        if (gXpStep == 0)
        {
            string base = "";
            if (ok) base = payload;
            string merged = applyWriteOp(kind, base);
            setNetCache(game, period, merged);
            if (!ok && err == XP_ERROR_KEY_NOT_FOUND)
            {
                gXpStep = 1;
                gXpReq = llCreateKeyValue(xpKey(game, period), merged);
                return;
            }
            if (ok)
            {
                gXpStep = 1;
                gXpReq = llUpdateKeyValue(xpKey(game, period), merged, TRUE, payload);
                return;
            }
            gXpOp = "";
            kickXp();
            return;
        }
        if (!ok)
        {
            enqueueXp(gXpOp, gInUid, gInName, gInScore);
        }
        gXpOp = "";
        gXpStep = 0;
        kickXp();
    }
}
