// Canasta — parlor scoreboard CORE (LSD + Experience + MOAP + score listen).
// Linkset: root = frame, child named "screen" (MoAP), child with Admin on "gear".
// Drop this script on the FRAME (root). Compile: Mono + Experience.
// Screen MoAP: Canasta_Scoreboard_Moap.lsl on the screen prim (link 93003).
// Admin menus: Canasta_Scoreboard_Admin.lsl on the gear prim (link 93001/93002).
// Restore point before table-style MoAP: git tag WORKS-BUT-BLANKS.

integer SCORE_CH = -18475021;
// Fallback if asset-rev.txt fetch fails. Prefer bumping public/asset-rev.txt on Pages deploys.
integer PAGE_ASSET_REV = 3;
string WEB_URL = "https://feudalism-dev.github.io/Canasta/";
float TIMER_SEC = 12.0;
integer ADMIN_CMD = 93001;
integer ADMIN_RSP = 93002;
integer MOAP_CMD = 93003;
string SCREEN_NAME = "screen";

string gCapUrl = "";
string gLastHome = "";
integer gMoapPending = FALSE;
integer gScreenLink = LINK_THIS;
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
integer gPageRev = 0;
key gRevReq = NULL_KEY;
integer gRevDone = FALSE;
integer gRevDeadline = 0;

integer effectiveRev()
{
    if (gPageRev > 0) return gPageRev;
    return PAGE_ASSET_REV;
}

requestAssetRev()
{
    if (gRevReq != NULL_KEY) return;
    gRevReq = llHTTPRequest(WEB_URL + "asset-rev.txt", [HTTP_METHOD, "GET"], "");
}

integer scheduleMoap()
{
    if (gCapUrl == "") return FALSE;
    if (!gRevDone) return FALSE;
    gMoapPending = TRUE;
    llSetTimerEvent(0.5);
    return TRUE;
}

integer findScreenLink()
{
    integer n = llGetObjectPrimCount(llGetKey());
    if (n < 1) n = llGetNumberOfPrims();
    integer i;
    for (i = 1; i <= n; i++)
    {
        string nm = llToLower(llStringTrim(llGetLinkName(i), STRING_TRIM));
        if (nm == SCREEN_NAME)
        {
            gScreenLink = i;
            return i;
        }
    }
    gScreenLink = LINK_THIS;
    return LINK_THIS;
}

string jsonEscape(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
}

string cleanName(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["~", "^", "|", ",", "\""], []), " ");
    s = llStringTrim(s, STRING_TRIM);
    if (llStringLength(s) > 18) s = llGetSubString(s, 0, 17);
    if (s == "") s = "Player";
    return s;
}

string normGame(string g)
{
    g = llToLower(llStringTrim(g, STRING_TRIM));
    if (g == "h" || g == "hf") return "h";
    return "c";
}

string weekId()
{
    return "w" + (string)((llGetUnixTime() / 86400 + 3) / 7);
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

// mode: 0=keep-higher insert, 1=force set, 2=remove uid
string mutatePacked(string packed, string uid, string nm, integer score, integer mode)
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
    if (mode == 2)
    {
        if (found < 0) return packed;
        uids = llDeleteSubList(uids, found, found);
        nms = llDeleteSubList(nms, found, found);
        scs = llDeleteSubList(scs, found, found);
        n = llGetListLength(uids);
    }
    else if (found >= 0)
    {
        nms = llListReplaceList(nms, [nm], found, found);
        if (mode == 1) scs = llListReplaceList(scs, [score], found, found);
        else if (score > llList2Integer(scs, found)) scs = llListReplaceList(scs, [score], found, found);
    }
    else if (mode != 2)
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

string loadLocal(string game, string period)
{
    return llLinksetDataRead(lsdKey(game, period));
}

integer saveLocal(string game, string period, string packed)
{
    llLinksetDataWrite(lsdKey(game, period), packed);
    return TRUE;
}

string loadNet(string game, string period)
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

integer setNet(string game, string period, string packed)
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

string bundleJson(string game)
{
    return "{\"w\":" + rowsToJson(loadLocal(game, "w"))
        + ",\"m\":" + rowsToJson(loadLocal(game, "m"))
        + ",\"l\":" + rowsToJson(loadLocal(game, "l")) + "}";
}

string netBundleJson(string game)
{
    return "{\"w\":" + rowsToJson(loadNet(game, "w"))
        + ",\"m\":" + rowsToJson(loadNet(game, "m"))
        + ",\"l\":" + rowsToJson(loadNet(game, "l")) + "}";
}

string scoresJson()
{
    rotateLocal();
    return "{\"ok\":true,\"week\":\"" + weekId()
        + "\",\"month\":\"" + monthId()
        + "\",\"local\":{\"c\":" + bundleJson("c") + ",\"h\":" + bundleJson("h")
        + "},\"net\":{\"c\":" + netBundleJson("c") + ",\"h\":" + netBundleJson("h") + "}}";
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
            llOwnerSay("Canasta scoreboard: compile with Experience for network scores.");
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
    gXpReq = llReadKeyValue(xpKey(llGetSubString(gXpOp, 1, 1), llGetSubString(gXpOp, 2, 2)));
    return TRUE;
}

integer ingest(string game, string uid, string nm, integer score)
{
    game = normGame(game);
    rotateLocal();
    nm = cleanName(nm);
    saveLocal(game, "w", mutatePacked(loadLocal(game, "w"), uid, nm, score, 0));
    saveLocal(game, "m", mutatePacked(loadLocal(game, "m"), uid, nm, score, 0));
    saveLocal(game, "l", mutatePacked(loadLocal(game, "l"), uid, nm, score, 0));
    enqueueXp("M" + game + "w", uid, nm, score);
    enqueueXp("M" + game + "m", uid, nm, score);
    enqueueXp("M" + game + "l", uid, nm, score);
    kickXp();
    return TRUE;
}

list periods(string period)
{
    if (period == "a") return ["w", "m", "l"];
    return [period];
}

integer adminLocal(string op, string game, string period, string uid, string nm, integer score)
{
    list ps = periods(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        string p = llList2String(ps, i);
        if (op == "Z") saveLocal(game, p, "");
        else if (op == "D") saveLocal(game, p, mutatePacked(loadLocal(game, p), uid, "", 0, 2));
        else saveLocal(game, p, mutatePacked(loadLocal(game, p), uid, nm, score, 1));
    }
    return TRUE;
}

integer adminNet(string op, string game, string period, string uid, string nm, integer score)
{
    list ps = periods(period);
    integer i;
    integer n = llGetListLength(ps);
    for (i = 0; i < n; i++)
    {
        enqueueXp(op + game + llList2String(ps, i), uid, nm, score);
    }
    kickXp();
    return TRUE;
}

string pickPacked(string scope, string game, string period)
{
    if (period == "a") period = "l";
    if (scope == "N") return loadNet(game, period);
    return loadLocal(game, period);
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

sendJsonp(key httpId, string callback, string json)
{
    if (httpId == NULL_KEY) return;
    if (callback == "" || llStringLength(callback) > 64)
    {
        llSetContentType(httpId, CONTENT_TYPE_TEXT);
        llHTTPResponse(httpId, 400, "{\"ok\":false}");
        return;
    }
    llSetContentType(httpId, CONTENT_TYPE_TEXT);
    llHTTPResponse(httpId, 200, callback + "(" + json + ");");
}

integer applyMoap()
{
    // Never paint without HTTP-IN — the scores page needs sl_cap.
    if (gCapUrl == "") return FALSE;
    string home = WEB_URL + "?view=scores&uid=board&rev=" + (string)effectiveRev()
        + "&sl_cap=" + llEscapeURL(gCapUrl);

    // Hard skip: rewriting the same home blanks CEF.
    if (home == gLastHome) return FALSE;

    // Screen script applies via llSetPrimMediaParams (table-display style).
    // force=1: clear + &cb= once when home actually changes.
    llMessageLinked(gScreenLink, MOAP_CMD, "1\n" + home, NULL_KEY);
    gLastHome = home;
    return TRUE;
}

integer takeScoreChat(string msg)
{
    if (llGetSubString(msg, 0, 8) != "CN_SCORE|") return FALSE;
    list parts = llParseStringKeepNulls(msg, ["|"], []);
    if (llGetListLength(parts) < 5) return FALSE;
    string game = normGame(llList2String(parts, 1));
    string uid = llList2String(parts, 2);
    string nm = llList2String(parts, 3);
    integer sc = (integer)llList2String(parts, 4);
    if (nm == "") return FALSE;
    if (uid == "") uid = llToLower(nm);
    ingest(game, uid, nm, sc);
    return TRUE;
}

string applyWriteOp(string kind, string base)
{
    if (kind == "Z") return "";
    if (kind == "D") return mutatePacked(base, gInUid, "", 0, 2);
    if (kind == "F") return mutatePacked(base, gInUid, gInName, gInScore, 1);
    return mutatePacked(base, gInUid, gInName, gInScore, 0);
}

integer handleAdmin(string str, key av)
{
    list p = llParseStringKeepNulls(str, ["|"], []);
    string cmd = llList2String(p, 0);
    if (cmd == "REFRESH")
    {
        enqueueReads();
        kickXp();
        llMessageLinked(LINK_SET, ADMIN_RSP, "OK|refresh", av);
        return TRUE;
    }
    if (cmd == "LIST")
    {
        string packed = pickPacked(llList2String(p, 1), normGame(llList2String(p, 2)), llList2String(p, 3));
        llMessageLinked(LINK_SET, ADMIN_RSP, "LIST|" + packed, av);
        return TRUE;
    }
    string scope = llList2String(p, 1);
    string game = normGame(llList2String(p, 2));
    string period = llList2String(p, 3);
    if (cmd == "CLEAR")
    {
        if (scope == "N") adminNet("Z", game, period, "", "", 0);
        else adminLocal("Z", game, period, "", "", 0);
        llMessageLinked(LINK_SET, ADMIN_RSP, "OK|clear", av);
        return TRUE;
    }
    if (cmd == "REMOVE")
    {
        string uid = llList2String(p, 4);
        if (scope == "N") adminNet("D", game, period, uid, "", 0);
        else adminLocal("D", game, period, uid, "", 0);
        llMessageLinked(LINK_SET, ADMIN_RSP, "OK|remove", av);
        return TRUE;
    }
    if (cmd == "FORCE")
    {
        // FORCE|scope|game|period|score|uid|name...
        integer sc = (integer)llList2String(p, 4);
        string uid = llList2String(p, 5);
        string nm = cleanName(llList2String(p, 6));
        integer i;
        for (i = 7; i < llGetListLength(p); i++) nm = cleanName(nm + " " + llList2String(p, i));
        if (uid == "") uid = llToLower(nm);
        if (scope == "N") adminNet("F", game, period, uid, nm, sc);
        else adminLocal("F", game, period, uid, nm, sc);
        llMessageLinked(LINK_SET, ADMIN_RSP, "OK|force", av);
        return TRUE;
    }
    return FALSE;
}

default
{
    state_entry()
    {
        rotateLocal();
        findScreenLink();
        llListen(SCORE_CH, "", NULL_KEY, "");
        gRevDone = FALSE;
        gRevDeadline = llGetUnixTime() + 5;
        gLastHome = "";
        gMoapPending = FALSE;
        llRequestSecureURL();
        requestAssetRev();
        enqueueReads();
        kickXp();
        llSetTimerEvent(0.5);
        llOwnerSay("Canasta scoreboard core ready. screen link=" + (string)gScreenLink
            + " Free=" + (string)llGetFreeMemory());
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_LINK)
        {
            integer prev = gScreenLink;
            findScreenLink();
            if (gScreenLink != prev)
            {
                gLastHome = "";
                scheduleMoap();
            }
        }
        if (change & CHANGED_REGION_START)
        {
            gCapUrl = "";
            gLastHome = "";
            gRevDone = FALSE;
            gRevReq = NULL_KEY;
            gRevDeadline = llGetUnixTime() + 5;
            llRequestSecureURL();
            requestAssetRev();
        }
    }

    timer()
    {
        if (!gRevDone && llGetUnixTime() >= gRevDeadline)
        {
            gRevDone = TRUE;
            scheduleMoap();
        }
        if (gMoapPending)
        {
            gMoapPending = FALSE;
            applyMoap();
        }
        if (gXpOp == "" && llGetListLength(gXpQ) == 0) enqueueReads();
        kickXp();
        llSetTimerEvent(TIMER_SEC);
    }

    listen(integer ch, string name, key id, string msg)
    {
        if (ch == SCORE_CH) takeScoreChat(msg);
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == ADMIN_CMD) handleAdmin(str, id);
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id != gRevReq) return;
        gRevReq = NULL_KEY;
        if (status == 200)
        {
            integer r = (integer)llStringTrim(body, STRING_TRIM);
            if (r > 0) gPageRev = r;
        }
        gRevDone = TRUE;
        scheduleMoap();
    }

    http_request(key id, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            string prev = gCapUrl;
            gCapUrl = body;
            llOwnerSay("Canasta scoreboard: HTTP-IN ready.");
            if (gCapUrl != prev) scheduleMoap();
            return;
        }
        if (method == URL_REQUEST_DENIED)
        {
            llOwnerSay("Canasta scoreboard: HTTP-IN denied.");
            return;
        }
        list q = parseQuery(llGetHTTPHeader(id, "x-query-string"));
        if (qget(q, "action") == "refresh")
        {
            enqueueReads();
            kickXp();
        }
        sendJsonp(id, qget(q, "cb"), scoresJson());
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
            if (ok) setNet(game, period, payload);
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
            setNet(game, period, merged);
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
        if (!ok) enqueueXp(gXpOp, gInUid, gInName, gInScore);
        gXpOp = "";
        gXpStep = 0;
        kickXp();
    }
}
