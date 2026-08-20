// Canasta — HTTP-IN JSONP front door
// Drop in the SAME prim as Canasta_Table.lsl (root / AVsitter).
// Compile: Mono. See Docs/SECOND_LIFE.md
// Owns the spectator board snapshot so Table stays under the Mono heap cap.
//
// Http ↔ Table: HTTP_CMD = 92001
//   Http → Table: REQ|httpId|cb|action|uid|seat|name|players|p
//   Http → Table: CAP|url
//   Table → Http: RESP|cb|json   (id = http request key)
//   Table → Http: STATUS|json
//   Table → Http: BOARD|i|n|chunk   (assemble snapshot)
//   Table → Http: BCLR|

integer HTTP_CMD = 92001;
float CAP_RETRY_SEC = 6.0;

string gCapUrl = "";
integer gCapRetry = 0;
string gLastStatus = "{\"ok\":true,\"mode\":\"idle\",\"roster\":[]}";
string gBoard = "";
string gBoardAcc = "";
integer gBoardNext = 0;
integer gBoardTot = 0;

string jsonEscape(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
}

string withBoard(string status)
{
    integer n = llStringLength(status);
    if (n < 2) return status;
    if (llGetSubString(status, n - 1, n - 1) != "}") return status;
    return llGetSubString(status, 0, n - 2) + ",\"board\":\"" + jsonEscape(gBoard) + "\"}";
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

handleHttp(key id, string query)
{
    list q = parseQuery(query);
    string action = qget(q, "action");
    string cb = qget(q, "cb");

    if (action == "" || action == "status")
    {
        sendJsonp(id, cb, withBoard(gLastStatus));
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
    p = llDumpList2String(llParseStringKeepNulls(p, ["|"], []), "%7C");
    toTable("REQ|" + (string)id + "|" + cb + "|" + action + "|" + uid + "|" + seat + "|" + pname + "|" + players + "|" + p);
}

default
{
    state_entry()
    {
        requestCap();
        llSetTimerEvent(CAP_RETRY_SEC);
        llOwnerSay("Canasta HTTP ready.");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION_START) requestCap();
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
        if (llGetSubString(str, 0, 4) == "RESP|")
        {
            string rest = llGetSubString(str, 5, -1);
            integer bar = llSubStringIndex(rest, "|");
            if (bar < 0) return;
            sendJsonp(id, llGetSubString(rest, 0, bar - 1), llGetSubString(rest, bar + 1, -1));
            return;
        }
        if (llGetSubString(str, 0, 6) == "STATUS|")
        {
            string json = llGetSubString(str, 7, -1);
            if (json != "") gLastStatus = json;
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
    }
}
