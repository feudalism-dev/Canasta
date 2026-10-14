// Parlor Hub — HTTP-IN JSONP + owner entitlements (Experience) + status JSON.
// Drop in the SAME prim as Parlor_Table.lsl. Compile: Mono + Experience.
// Table sends compact STATUS/RESP pipes; this script expands them to JSON (heap relief).
// See Docs/PLAN_PARLOR_HUB.md
//
// Http ↔ Table: HTTP_CMD = 92001
//   Http → Table: REQ|…  CAP|  BGATE|  FAMSET|<family>
//   Table → Http: RESP|cb|<pipe or {json}>  STATUS|<pipe>  BOARD|  BCLR|  BCLEAR|
//                 BGATEOK|  BGATEFAIL|  ENTNEED|

integer HTTP_CMD = 92001;
integer DISPLAY_CMD_FAMILY = 91007;
float CAP_RETRY_SEC = 6.0;
integer MAX_SEATS = 4;
integer BROWSER_TOKEN_TTL = 600;
/** Soft cache only — sit/enter force a fresh Experience read. */
integer ENT_STALE_SEC = 45;
integer ENT_IDLE_SEC = 3600;
string LSD_FAM = "cn.fam";
string LSD_ENT = "cn.ent";
string XP_PREFIX = "cn.ent.";

string gCapUrl = "";
integer gCapRetry = 0;
string gLastStatus = "{\"ok\":true,\"mode\":\"idle\",\"roster\":[]}";
string gBoard = "";
string gBoardAcc = "";
integer gBoardNext = 0;
integer gBoardTot = 0;

list gBrowserTok = [];
list gBrowserExp = [];

key gPendHttp = NULL_KEY;
string gPendCb = "";
string gPendOp = "";
key gPendUid = NULL_KEY;
string gPendToken = "";

string gEnt = "";
integer gEntFetchedAt = 0;
key gEntReq = NULL_KEY;

integer tableChannel()
{
    return (integer)("0x" + llGetSubString((string)llGetKey(), 0, 7)) * -1;
}

string jsonEscape(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
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
    return "";
}

string packedBody(string packed)
{
    if (llGetSubString(packed, 0, 1) == "v1")
    {
        if (llStringLength(packed) > 3) return llGetSubString(packed, 3, -1);
        return "";
    }
    return packed;
}

integer familyOwned(string fam)
{
    if (fam == "") return FALSE;
    list parts = llParseString2List(gEnt, [","], []);
    integer i;
    integer n = llGetListLength(parts);
    for (i = 0; i < n; i++)
    {
        if (llList2String(parts, i) == fam) return TRUE;
    }
    return FALSE;
}

integer hasExperience()
{
    return (llGetListLength(llGetExperienceDetails(NULL_KEY)) > 0);
}

broadcastFamily(string fam)
{
    llLinksetDataWrite(LSD_FAM, fam);
    llMessageLinked(LINK_SET, DISPLAY_CMD_FAMILY, fam, NULL_KEY);
    llRegionSay(tableChannel(), "CN_FAMILY|" + (string)llGetKey() + "|" + fam);
    llMessageLinked(LINK_THIS, HTTP_CMD, "FAMSET|" + fam, NULL_KEY);
}

applyEntCache(string packed)
{
    gEnt = packedBody(packed);
    llLinksetDataWrite(LSD_ENT, gEnt);
    gEntFetchedAt = llGetUnixTime();
    string fam = normFamily(llLinksetDataRead(LSD_FAM));
    if (fam != "" && !familyOwned(fam))
    {
        broadcastFamily("");
    }
}

/** LSD survives script reset — wipe prior owner's library on ownership change. */
clearOwnerEntitlements()
{
    gEnt = "";
    gEntFetchedAt = 0;
    gEntReq = NULL_KEY;
    llLinksetDataWrite(LSD_ENT, "");
    llLinksetDataWrite(LSD_FAM, "");
    llMessageLinked(LINK_SET, DISPLAY_CMD_FAMILY, "", NULL_KEY);
    llMessageLinked(LINK_THIS, HTTP_CMD, "FAMSET|", NULL_KEY);
}

requestEntitlements(integer force)
{
    integer now = llGetUnixTime();
    if (!force && gEntFetchedAt > 0 && (now - gEntFetchedAt) < ENT_STALE_SEC) return;
    if (gEntReq != NULL_KEY) return;
    if (!hasExperience())
    {
        gEnt = llLinksetDataRead(LSD_ENT);
        gEntFetchedAt = now;
        return;
    }
    // Always key by current owner (new owner after CHANGED_OWNER / reset).
    gEntReq = llReadKeyValue(XP_PREFIX + (string)llGetOwner());
}

// Table status pipe → JSON. Pass-through if already JSON (`{…}`).
string expandStatus(string pipe)
{
    if (pipe == "") return "{\"ok\":false}";
    if (llGetSubString(pipe, 0, 0) == "{") return pipe;
    list p = llParseStringKeepNulls(pipe, ["|"], []);
    integer ok = (integer)llList2String(p, 0);
    string mode = llList2String(p, 1);
    string active = llList2String(p, 2);
    string seated = llList2String(p, 3);
    string room = llList2String(p, 4);
    string host = llList2String(p, 5);
    string solo = llList2String(p, 6);
    string rost = llList2String(p, 7);
    string gr = llList2String(p, 8);
    string err = "";
    if (llGetListLength(p) > 9) err = llList2String(p, 9);
    string roster = "[";
    integer first = TRUE;
    if (rost != "")
    {
        list rows = llParseStringKeepNulls(rost, ["^"], []);
        integer i;
        integer n = llGetListLength(rows);
        for (i = 0; i < n; i++)
        {
            list c = llParseStringKeepNulls(llList2String(rows, i), ["~"], []);
            if (llGetListLength(c) < 5) jump rskip;
            if (!first) roster += ",";
            first = FALSE;
            roster += "{\"seat\":" + llList2String(c, 0)
                + ",\"uid\":\"" + llList2String(c, 1)
                + "\",\"active\":" + llList2String(["false", "true"], (integer)llList2String(c, 2))
                + ",\"joined\":" + llList2String(["false", "true"], (integer)llList2String(c, 3))
                + ",\"name\":\"" + jsonEscape(llList2String(c, 4)) + "\"}";
            @rskip;
        }
    }
    roster += "]";
    string grace = "[";
    first = TRUE;
    integer now = llGetUnixTime();
    if (gr != "")
    {
        list grows = llParseStringKeepNulls(gr, ["^"], []);
        integer gi;
        integer gn = llGetListLength(grows);
        for (gi = 0; gi < gn; gi++)
        {
            list c = llParseStringKeepNulls(llList2String(grows, gi), ["~"], []);
            if (llGetListLength(c) < 3) jump gskip;
            integer untilUnix = (integer)llList2String(c, 2);
            string nm = "";
            if (llGetListLength(c) > 3) nm = llList2String(c, 3);
            if (!first) grace += ",";
            first = FALSE;
            grace += "{\"uid\":\"" + llList2String(c, 0)
                + "\",\"seat\":" + llList2String(c, 1)
                + ",\"until\":" + (string)untilUnix
                + ",\"secondsLeft\":" + (string)(untilUnix - now)
                + ",\"name\":\"" + jsonEscape(nm) + "\"}";
            @gskip;
        }
    }
    grace += "]";
    string j = "{\"ok\":" + llList2String(["false", "true"], ok)
        + ",\"tableId\":\"" + (string)llGetKey()
        + "\",\"mode\":\"" + jsonEscape(mode)
        + "\",\"activeCount\":" + active
        + ",\"seatedCount\":" + seated
        + ",\"roomCode\":\"" + jsonEscape(room)
        + "\",\"hostUid\":\"" + host
        + "\",\"soloUid\":\"" + solo
        + "\",\"grace\":" + grace
        + ",\"roster\":" + roster;
    if (err != "") j += ",\"error\":\"" + jsonEscape(err) + "\"";
    return j + "}";
}

string withBoard(string status)
{
    integer n = llStringLength(status);
    if (n < 2) return status;
    if (llGetSubString(status, n - 1, n - 1) != "}") return status;
    return llGetSubString(status, 0, n - 2) + ",\"board\":\"" + jsonEscape(gBoard) + "\"}";
}

string withHouse(string status)
{
    integer n = llStringLength(status);
    if (n < 2) return status;
    if (llGetSubString(status, n - 1, n - 1) != "}") return status;
    string packed = llLinksetDataRead("cn.hf");
    string owner = (string)llGetOwner();
    return llGetSubString(status, 0, n - 2)
        + ",\"ownerUid\":\"" + owner
        + "\",\"house\":\"" + jsonEscape(packed) + "\"}";
}

string withHub(string status)
{
    integer n = llStringLength(status);
    if (n < 2) return status;
    if (llGetSubString(status, n - 1, n - 1) != "}") return status;
    string fam = llLinksetDataRead(LSD_FAM);
    string ent = gEnt;
    if (ent == "") ent = llLinksetDataRead(LSD_ENT);
    return llGetSubString(status, 0, n - 2)
        + ",\"hub\":true"
        + ",\"family\":\"" + jsonEscape(fam)
        + "\",\"entitlements\":\"" + jsonEscape(ent) + "\"}";
}

string statusOut(string status)
{
    return withHub(withHouse(withBoard(status)));
}

integer statusIsIdle()
{
    return (llSubStringIndex(gLastStatus, "\"mode\":\"idle\"") >= 0);
}

integer statusHasUid(string uid)
{
    if (uid == "") return FALSE;
    return (llSubStringIndex(gLastStatus, "\"uid\":\"" + uid + "\"") >= 0);
}

handleSetFamily(key id, string cb, string uid, string p)
{
    if (!statusIsIdle())
    {
        sendJsonp(id, cb, statusOut("{\"ok\":false,\"error\":\"table busy\"}"));
        return;
    }
    if (!statusHasUid(uid))
    {
        sendJsonp(id, cb, statusOut("{\"ok\":false,\"error\":\"not seated\"}"));
        return;
    }
    if (p == "" || p == "none" || p == "-")
    {
        broadcastFamily("");
        sendJsonp(id, cb, statusOut(gLastStatus));
        return;
    }
    string want = normFamily(p);
    if (want == "")
    {
        sendJsonp(id, cb, statusOut("{\"ok\":false,\"error\":\"bad family\"}"));
        return;
    }
    if (gEnt == "") gEnt = llLinksetDataRead(LSD_ENT);
    if (!familyOwned(want))
    {
        sendJsonp(id, cb, statusOut("{\"ok\":false,\"error\":\"not entitled\"}"));
        return;
    }
    broadcastFamily(want);
    sendJsonp(id, cb, statusOut(gLastStatus));
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

toTable(string msg)
{
    llMessageLinked(LINK_THIS, HTTP_CMD, msg, NULL_KEY);
}

clearBoard()
{
    gBoard = "";
    gBoardAcc = "";
    gBoardNext = 0;
    gBoardTot = 0;
}

initBrowser()
{
    gBrowserTok = ["", "", "", ""];
    gBrowserExp = [0, 0, 0, 0];
}

clearBrowserSeat(integer seat)
{
    if (seat < 0 || seat >= MAX_SEATS) return;
    gBrowserTok = llListReplaceList(gBrowserTok, [""], seat, seat);
    gBrowserExp = llListReplaceList(gBrowserExp, [0], seat, seat);
}

clearAllBrowser()
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++) clearBrowserSeat(i);
}

clearPend()
{
    gPendHttp = NULL_KEY;
    gPendCb = "";
    gPendOp = "";
    gPendUid = NULL_KEY;
    gPendToken = "";
}

string mintToken()
{
    string k = (string)llGenerateKey();
    return llToLower(llDumpList2String(llParseString2List(k, ["-"], []), ""));
}

string statusWithToken(string token, integer exp)
{
    string j = statusOut(gLastStatus);
    integer n = llStringLength(j);
    if (n < 2) return "{\"ok\":false,\"error\":\"no status\"}";
    return llGetSubString(j, 0, n - 2)
        + ",\"token\":\"" + jsonEscape(token)
        + "\",\"exp\":" + (string)exp + "}";
}

integer takeBoardChunk(string payload)
{
    list bp = llParseStringKeepNulls(payload, ["|"], []);
    if (llList2String(bp, 0) != "BOARD") return FALSE;
    integer idx = (integer)llList2String(bp, 1);
    integer tot = (integer)llList2String(bp, 2);
    string chunk = "";
    integer k;
    integer n = llGetListLength(bp);
    for (k = 3; k < n; k++)
    {
        if (k > 3) chunk += "|";
        chunk += llList2String(bp, k);
    }
    if (tot < 1) tot = 1;
    if (idx == 0)
    {
        gBoardAcc = chunk;
        gBoardNext = 1;
        gBoardTot = tot;
    }
    else
    {
        if (idx != gBoardNext) return TRUE;
        if (tot != gBoardTot) return TRUE;
        gBoardAcc += chunk;
        gBoardNext += 1;
    }
    if (gBoardNext >= gBoardTot)
    {
        gBoard = gBoardAcc;
        gBoardAcc = "";
        gBoardNext = 0;
        gBoardTot = 0;
    }
    return TRUE;
}

requestCap()
{
    llRequestSecureURL();
}

failPend(string err)
{
    if (gPendHttp == NULL_KEY) return;
    sendJsonp(gPendHttp, gPendCb, "{\"ok\":false,\"error\":\"" + jsonEscape(err) + "\"}");
    clearPend();
}

finishMint(integer seat, string room)
{
    string token = mintToken();
    integer exp = llGetUnixTime() + BROWSER_TOKEN_TTL;
    gBrowserTok = llListReplaceList(gBrowserTok, [token], seat, seat);
    gBrowserExp = llListReplaceList(gBrowserExp, [exp], seat, seat);
    sendJsonp(gPendHttp, gPendCb, statusWithToken(token, exp));
    clearPend();
}

finishClaim(integer seat, string room)
{
    string want = llToLower(llStringTrim(gPendToken, STRING_TRIM));
    if (want == "")
    {
        failPend("token required");
        return;
    }
    if (want != llList2String(gBrowserTok, seat))
    {
        failPend("bad token");
        return;
    }
    if (llGetUnixTime() > llList2Integer(gBrowserExp, seat))
    {
        failPend("token expired");
        return;
    }
    sendJsonp(gPendHttp, gPendCb, statusOut(gLastStatus));
    clearPend();
}

handleHttp(key id, string query)
{
    list q = parseQuery(query);
    string action = qget(q, "action");
    string cb = qget(q, "cb");

    if (action == "" || action == "status")
    {
        // Pick up registrations done while seated (Register HUD → Experience).
        if (statusIsIdle()) requestEntitlements(FALSE);
        sendJsonp(id, cb, statusOut(gLastStatus));
        return;
    }
    if (action == "board")
    {
        sendJsonp(id, cb, "{\"ok\":true,\"board\":\"" + jsonEscape(gBoard) + "\"}");
        return;
    }

    string uid = qget(q, "uid");
    string seat = qget(q, "seat");
    string pname = qget(q, "name");
    string players = qget(q, "players");
    string p = qget(q, "p");

    if (action == "save_house")
    {
        if (uid == "" || (key)uid != llGetOwner())
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"owner only\"}");
            return;
        }
        if (llStringLength(p) < 8 || llStringLength(p) > 200)
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"bad house payload\"}");
            return;
        }
        if (llGetSubString(p, 0, 1) != "v1")
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"bad house version\"}");
            return;
        }
        llLinksetDataWrite("cn.hf", p);
        sendJsonp(id, cb, statusOut("{\"ok\":true}"));
        return;
    }

    if (action == "set_family")
    {
        handleSetFamily(id, cb, uid, p);
        return;
    }

    if (action == "refresh_entitlements")
    {
        if (gPendHttp != NULL_KEY)
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"busy\"}");
            return;
        }
        gPendHttp = id;
        gPendCb = cb;
        gPendOp = "refresh_ent";
        requestEntitlements(TRUE);
        if (gEntReq == NULL_KEY)
        {
            sendJsonp(id, cb, statusOut(gLastStatus));
            clearPend();
        }
        return;
    }

    if (action == "mint_browser" || action == "claim_browser")
    {
        if (gPendHttp != NULL_KEY)
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"busy\"}");
            return;
        }
        if (uid == "")
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"uid required\"}");
            return;
        }
        gPendHttp = id;
        gPendCb = cb;
        gPendOp = action;
        gPendUid = (key)uid;
        gPendToken = p;
        toTable("BGATE|" + action + "|" + uid + "|" + seat);
        return;
    }

    p = llDumpList2String(llParseStringKeepNulls(p, ["|"], []), "%7C");
    toTable("REQ|" + (string)id + "|" + cb + "|" + action + "|" + uid + "|" + seat + "|" + pname + "|" + players + "|" + p);
}

default
{
    state_entry()
    {
        initBrowser();
        clearPend();
        // Soft cache only — Experience read is authoritative for this owner.
        gEnt = llLinksetDataRead(LSD_ENT);
        requestCap();
        requestEntitlements(TRUE);
        llSetTimerEvent(CAP_RETRY_SEC);
        llOwnerSay("Parlor HTTP ready. Free=" + (string)llGetFreeMemory());
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION_START) requestCap();
        if (change & CHANGED_OWNER)
        {
            // Clear before reset so state_entry does not briefly serve the prior owner.
            clearOwnerEntitlements();
            llOwnerSay("Parlor: owner changed — reloading registrations for new owner.");
            llResetScript();
        }
    }

    dataserver(key query, string data)
    {
        if (query != gEntReq) return;
        gEntReq = NULL_KEY;
        // "1,<value>" / "0,<err>" — value may contain commas; do not llCSV2List.
        integer ok = FALSE;
        string rest = "";
        integer comma = llSubStringIndex(data, ",");
        if (comma < 0) ok = (integer)data;
        else
        {
            ok = (integer)llGetSubString(data, 0, comma - 1);
            rest = llGetSubString(data, comma + 1, -1);
        }
        if (ok) applyEntCache(rest);
        else if ((integer)rest == XP_ERROR_KEY_NOT_FOUND) applyEntCache("");
        else gEntFetchedAt = llGetUnixTime();
        if (gPendOp == "refresh_ent" && gPendHttp != NULL_KEY)
        {
            sendJsonp(gPendHttp, gPendCb, statusOut(gLastStatus));
            clearPend();
        }
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num != HTTP_CMD) return;
        if (str == "NEEDCAP")
        {
            if (gCapUrl != "") toTable("CAP|" + gCapUrl);
            else requestCap();
            return;
        }
        if (llGetSubString(str, 0, 7) == "ENTNEED|")
        {
            // Table sit/enter always forces; "|0" keeps soft cache for rare callers.
            integer force = TRUE;
            if (llGetSubString(str, 8, -1) == "0") force = FALSE;
            requestEntitlements(force);
            return;
        }
        if (llGetSubString(str, 0, 4) == "RESP|")
        {
            string rest = llGetSubString(str, 5, -1);
            integer bar = llSubStringIndex(rest, "|");
            if (bar < 0) return;
            string cb = llGetSubString(rest, 0, bar - 1);
            string body = llGetSubString(rest, bar + 1, -1);
            string core = expandStatus(body);
            if (llSubStringIndex(core, "\"tableId\"") >= 0) gLastStatus = core;
            sendJsonp(id, cb, statusOut(core));
            return;
        }
        if (llGetSubString(str, 0, 6) == "STATUS|")
        {
            string body = llGetSubString(str, 7, -1);
            if (body != "") gLastStatus = expandStatus(body);
            return;
        }
        if (llGetSubString(str, 0, 5) == "BOARD|")
        {
            takeBoardChunk(str);
            return;
        }
        if (llGetSubString(str, 0, 4) == "BCLR|")
        {
            clearBoard();
            return;
        }
        if (llGetSubString(str, 0, 6) == "BCLEAR|")
        {
            string rest = llGetSubString(str, 7, -1);
            if (rest == "") clearAllBrowser();
            else clearBrowserSeat((integer)rest);
            return;
        }
        if (llGetSubString(str, 0, 7) == "BGATEOK|")
        {
            list gp = llParseStringKeepNulls(str, ["|"], []);
            string op = llList2String(gp, 1);
            integer seat = (integer)llList2String(gp, 2);
            string room = llList2String(gp, 3);
            if (gPendHttp == NULL_KEY) return;
            if (op == "mint_browser") finishMint(seat, room);
            else if (op == "claim_browser") finishClaim(seat, room);
            else failPend("bad gate op");
            return;
        }
        if (llGetSubString(str, 0, 9) == "BGATEFAIL|")
        {
            failPend(llGetSubString(str, 10, -1));
            return;
        }
    }

    http_request(key id, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            gCapUrl = body;
            gCapRetry = 0;
            toTable("CAP|" + gCapUrl);
            return;
        }
        if (method == URL_REQUEST_DENIED)
        {
            gCapUrl = "";
            gCapRetry++;
            return;
        }
        string query = llGetHTTPHeader(id, "x-query-string");
        if (query == "" && llSubStringIndex(body, "action=") == 0) query = body;
        handleHttp(id, query);
    }

    timer()
    {
        if (gCapUrl == "" && gCapRetry < 8) requestCap();
        if (statusIsIdle() && gEntFetchedAt > 0)
        {
            if ((llGetUnixTime() - gEntFetchedAt) >= ENT_IDLE_SEC)
            {
                requestEntitlements(TRUE);
            }
        }
    }
}
