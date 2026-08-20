// Canasta — parlor scoreboard (LSD local + Experience network + MOAP UI).
// Drop this script on its OWN object (not the game table). Compile: Mono + same Experience as the table.
// Media face 0 shows GitHub Pages ?view=scores. No Furware. Tabs are on the web page.
// Listens for llShout from Canasta_Scores.lsl: CN_SCORE|c|uuid|Name|8441  (c=Canasta, h=Hand&Foot)

integer SCORE_CH = -18475021;
integer MEDIA_FACE = 0;
integer MEDIA_PIXELS = 1024;
integer PAGE_ASSET_REV = 2;
string WEB_URL = "https://feudalism-dev.github.io/Canasta/";
float TIMER_SEC = 12.0;

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

integer hasXp()
{
    return (llGetListLength(llGetExperienceDetails(NULL_KEY)) > 0);
}

string insertPacked(string packed, string uid, string nm, integer score)
{
    if (uid == "" || uid == (string)NULL_KEY) return packed;
    list uids = [];
    list nms = [];
    list scs = [];
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
                uids += [llList2String(f, 0)];
                nms += [llList2String(f, 1)];
                scs += [(integer)llList2String(f, 2)];
            }
        }
    }
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
        n += 1;
    }
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
    for (i = 0; i < n; i++)
    {
        if (i) out += "^";
        out += llList2String(uids, i) + "~" + llList2String(nms, i) + "~" + (string)llList2Integer(scs, i);
    }
    return out;
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
        llOwnerSay("Canasta scoreboard: MOAP face " + (string)MEDIA_FACE + ", listen " + (string)SCORE_CH + ".");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION_START) llRequestSecureURL();
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
        if (ch == SCORE_CH) takeScoreChat(msg);
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
        if (kind != "M")
        {
            gXpOp = "";
            kickXp();
            return;
        }
        if (gXpStep == 0)
        {
            string base = "";
            if (ok) base = payload;
            string merged = insertPacked(base, gInUid, gInName, gInScore);
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
