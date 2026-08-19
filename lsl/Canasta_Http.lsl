// Canasta — HTTP-IN JSONP front door
// Drop in the SAME prim as Canasta_Table.lsl (root / AVsitter).
// Compile: Mono. See Docs/SECOND_LIFE.md
//
// Http ↔ Table: HTTP_CMD = 92001
//   Http → Table: REQ|httpId|cb|action|uid|seat|name|players|p
//   Http → Table: CAP|url
//   Table → Http: RESP|httpId|cb|json   (one-shot JSONP; does not replace status cache)
//   Table → Http: STATUS|json   (cached for action=status)
// action=board GET (empty p) reads the public spectator snapshot; host/solo POST p writes it.

integer HTTP_CMD = 92001;

float CAP_RETRY_SEC = 6.0;

string gCapUrl = "";
key gUrlReq = NULL_KEY;
integer gCapRetry = 0;
string gLastStatus = "{\"ok\":true,\"mode\":\"idle\",\"roster\":[]}";
integer DEBUG = FALSE;

integer debug(string m)
{
    if (DEBUG) llOwnerSay("CN HTTP: " + m);
    return TRUE;
}

string jsonEscape(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
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
                llUnescapeURL(llGetSubString(pair, eq + 1, -1))
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

requestCap()
{
    gUrlReq = llRequestSecureURL();
}

handleHttp(key id, string method, string body, string query)
{
    list q = parseQuery(query);
    string action = qget(q, "action");
    string cb = qget(q, "cb");

    if (action == "" || action == "status")
    {
        sendJsonp(id, cb, gLastStatus);
        return;
    }

    string uid = qget(q, "uid");
    string seat = qget(q, "seat");
    string pname = qget(q, "name");
    string players = qget(q, "players");
    string p = qget(q, "p");
    // Pipe may contain | — keep as last field; Table reparses from query extras if needed.
    // Encode p with no raw pipes: use %7C already unescaped by parseQuery.
    // Re-escape pipes for link transport.
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
        // RESP uses id=http request key; str = cb|json
        if (llGetSubString(str, 0, 4) == "RESP|")
        {
            string rest = llGetSubString(str, 5, -1);
            integer bar = llSubStringIndex(rest, "|");
            if (bar < 0) return;
            string cb = llGetSubString(rest, 0, bar - 1);
            string json = llGetSubString(rest, bar + 1, -1);
            sendJsonp(id, cb, json);
            return;
        }
        if (llGetSubString(str, 0, 6) == "STATUS|")
        {
            string json = llGetSubString(str, 7, -1);
            if (json != "") gLastStatus = json;
            return;
        }
    }

    http_request(key id, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            gCapUrl = body;
            gCapRetry = 0;
            debug("HTTP-IN " + gCapUrl);
            toTable("CAP|" + gCapUrl);
            return;
        }
        if (method == URL_REQUEST_DENIED)
        {
            gCapUrl = "";
            gCapRetry++;
            debug("HTTP-IN denied; retry " + (string)gCapRetry);
            return;
        }
        string query = llGetHTTPHeader(id, "x-query-string");
        if (query == "" && llSubStringIndex(body, "action=") == 0) query = body;
        handleHttp(id, method, body, query);
    }

    timer()
    {
        if (gCapUrl == "" && gCapRetry < 8) requestCap();
    }
}
