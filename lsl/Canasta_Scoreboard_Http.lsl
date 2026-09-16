// Canasta — scoreboard HTTP-IN + MoAP (thin; keeps FreeMemory high for JSONP).
// Drop on the FRAME (root) with Canasta_Scoreboard.lsl. Compile: Mono.
// Core (storage/XP) talks via link 93004: REFRESH | REPAINT

integer MEDIA_FACE = 0;
integer MEDIA_W = 1024;
integer MEDIA_H = 720;
integer PAGE_ASSET_REV = 66;
string WEB_URL = "https://feudalism-dev.github.io/Canasta/";
float CAP_RETRY_SEC = 8.0;
integer CAP_REFRESH_SEC = 21600;
integer CAP_SILENCE_SEC = 90;
integer HTTP_CMD = 93004;
string SCREEN_NAME = "screen";

string gCapUrl = "";
string gLastHome = "";
string gJson = "";
integer gMoapPending = FALSE;
integer gScreenLink = LINK_THIS;
integer gPageRev = 0;
key gRevReq = NULL_KEY;
integer gRevDone = FALSE;
integer gRevDeadline = 0;
integer gCapRetry = 0;
integer gCapRefreshAt = 0;
integer gCapPending = FALSE;
integer gLastClientAt = 0;

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

requestCap(integer hard)
{
    if (hard)
    {
        if (gCapUrl != "")
        {
            llReleaseURL(gCapUrl);
            gCapUrl = "";
        }
        gLastHome = "";
        gMoapPending = FALSE;
        gLastClientAt = 0;
    }
    if (gCapPending) return;
    gCapPending = TRUE;
    llRequestSecureURL();
}

integer scheduleMoap()
{
    if (gCapUrl == "") return FALSE;
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
        if (llToLower(llStringTrim(llGetLinkName(i), STRING_TRIM)) == SCREEN_NAME)
        {
            gScreenLink = i;
            return i;
        }
    }
    gScreenLink = LINK_THIS;
    return LINK_THIS;
}

string weekId()
{
    return "w" + (string)((llGetUnixTime() / 86400 + 3) / 7);
}

string monthId()
{
    return llGetSubString(llGetTimestamp(), 0, 6);
}

rotateLocal()
{
    string wk = weekId();
    string mk = monthId();
    if (llLinksetDataRead("lwk") != wk)
    {
        llLinksetDataWrite("lcw", "");
        llLinksetDataWrite("lhw", "");
        llLinksetDataWrite("lsw", "");
        llLinksetDataWrite("lbw", "");
        llLinksetDataWrite("lwk", wk);
    }
    if (llLinksetDataRead("lmk") != mk)
    {
        llLinksetDataWrite("lcm", "");
        llLinksetDataWrite("lhm", "");
        llLinksetDataWrite("lsm", "");
        llLinksetDataWrite("lbm", "");
        llLinksetDataWrite("lmk", mk);
    }
}

string jsonEscape(string s)
{
    if (llSubStringIndex(s, "\\") < 0 && llSubStringIndex(s, "\"") < 0 && llSubStringIndex(s, "\n") < 0)
        return s;
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
}

appendRowsJson(string packed)
{
    if (packed == "")
    {
        gJson += "[]";
        return;
    }
    list recs = llParseStringKeepNulls(packed, ["^"], []);
    gJson += "[";
    integer i;
    integer n = llGetListLength(recs);
    integer wrote = 0;
    for (i = 0; i < n; i++)
    {
        list f = llParseStringKeepNulls(llList2String(recs, i), ["~"], []);
        if (llGetListLength(f) < 3) jump skiprow;
        if (wrote) gJson += ",";
        gJson += "{\"u\":\"" + jsonEscape(llList2String(f, 0))
            + "\",\"n\":\"" + jsonEscape(llList2String(f, 1))
            + "\",\"s\":" + llList2String(f, 2) + "}";
        wrote += 1;
        @skiprow;
    }
    gJson += "]";
}

appendBundleJson(integer isLocal, string game)
{
    string pref = "l";
    if (!isLocal) pref = "n";
    gJson += "{\"w\":";
    appendRowsJson(llLinksetDataRead(pref + game + "w"));
    gJson += ",\"m\":";
    appendRowsJson(llLinksetDataRead(pref + game + "m"));
    gJson += ",\"l\":";
    appendRowsJson(llLinksetDataRead(pref + game + "l"));
    gJson += "}";
}

buildGameJson(string game)
{
    if (game != "c" && game != "h" && game != "s" && game != "b") game = "c";
    rotateLocal();
    gJson = "{\"ok\":true,\"week\":\"" + weekId() + "\",\"month\":\"" + monthId()
        + "\",\"game\":\"" + game + "\",\"local\":{\"" + game + "\":";
    appendBundleJson(TRUE, game);
    gJson += "},\"net\":{\"" + game + "\":";
    appendBundleJson(FALSE, game);
    gJson += "}}";
}

string qparam(string qs, string name)
{
    string needle = name + "=";
    integer at = llSubStringIndex(qs, needle);
    if (at < 0) return "";
    integer start = at + llStringLength(needle);
    string rest = llGetSubString(qs, start, -1);
    integer amp = llSubStringIndex(rest, "&");
    if (amp < 0) return llUnescapeURL(rest);
    return llUnescapeURL(llGetSubString(rest, 0, amp - 1));
}

sendJsonp(key httpId, string callback, string game)
{
    if (httpId == NULL_KEY) return;
    if (callback == "" || llStringLength(callback) > 64)
    {
        llSetContentType(httpId, CONTENT_TYPE_TEXT);
        llHTTPResponse(httpId, 400, "{\"ok\":false}");
        return;
    }
    buildGameJson(game);
    llSetContentType(httpId, CONTENT_TYPE_TEXT);
    llHTTPResponse(httpId, 200, callback + "(" + gJson + ");");
    gJson = "";
}

integer applyMoap()
{
    if (gCapUrl == "") return FALSE;
    string home = WEB_URL + "?view=scores&uid=board&rev=" + (string)effectiveRev()
        + "&sl_cap=" + llEscapeURL(gCapUrl);
    if (home == gLastHome) return FALSE;
    string cur = home + "&cb=" + (string)llGetUnixTime();
    llSetLinkMedia(gScreenLink, MEDIA_FACE, [
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_CURRENT_URL, cur,
        PRIM_MEDIA_HOME_URL, home,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, MEDIA_W,
        PRIM_MEDIA_HEIGHT_PIXELS, MEDIA_H,
        PRIM_MEDIA_WHITELIST_ENABLE, FALSE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE
    ]);
    gLastHome = home;
    llOwnerSay("Canasta scoreboard: media on link " + (string)gScreenLink
        + " rev=" + (string)effectiveRev() + " Free=" + (string)llGetFreeMemory() + ".");
    return TRUE;
}

default
{
    state_entry()
    {
        findScreenLink();
        gRevDone = FALSE;
        gRevDeadline = llGetUnixTime() + 5;
        gLastHome = "";
        gMoapPending = FALSE;
        gCapRetry = 0;
        gCapPending = FALSE;
        gLastClientAt = 0;
        gCapRefreshAt = llGetUnixTime() + CAP_REFRESH_SEC;
        requestCap(TRUE);
        requestAssetRev();
        llSetTimerEvent(0.5);
        llOwnerSay("Canasta scoreboard HTTP ready. screen=" + (string)gScreenLink
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
            gCapRetry = 0;
            gCapPending = FALSE;
            gRevDone = FALSE;
            gRevReq = NULL_KEY;
            gRevDeadline = llGetUnixTime() + 5;
            gCapRefreshAt = llGetUnixTime() + CAP_REFRESH_SEC;
            requestCap(TRUE);
            requestAssetRev();
            llOwnerSay("Canasta scoreboard HTTP: region restart — renewing.");
        }
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num != HTTP_CMD) return;
        if (str == "REFRESH")
        {
            gCapPending = FALSE;
            requestCap(TRUE);
            return;
        }
        if (str == "REPAINT")
        {
            gLastHome = "";
            scheduleMoap();
        }
    }

    timer()
    {
        if (!gRevDone && llGetUnixTime() >= gRevDeadline) gRevDone = TRUE;
        if (gMoapPending)
        {
            gMoapPending = FALSE;
            applyMoap();
        }
        if (gCapUrl == "")
        {
            if (!gCapPending && gCapRetry < 12) requestCap(TRUE);
            llSetTimerEvent(CAP_RETRY_SEC);
            return;
        }
        if (gLastHome != "" && gLastClientAt > 0
            && (llGetUnixTime() - gLastClientAt) >= CAP_SILENCE_SEC)
        {
            llOwnerSay("Canasta scoreboard HTTP: no MoAP polls — renewing.");
            gLastClientAt = llGetUnixTime();
            gCapRefreshAt = llGetUnixTime() + CAP_REFRESH_SEC;
            requestCap(FALSE);
            llSetTimerEvent(0.5);
            return;
        }
        if (llGetUnixTime() >= gCapRefreshAt)
        {
            gCapRefreshAt = llGetUnixTime() + CAP_REFRESH_SEC;
            requestCap(FALSE);
            llSetTimerEvent(0.5);
            return;
        }
        if (gLastHome == "") llSetTimerEvent(0.5);
        else llSetTimerEvent(12.0);
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id != gRevReq) return;
        gRevReq = NULL_KEY;
        if (status == 200)
        {
            integer r = (integer)llStringTrim(body, STRING_TRIM);
            if (r > 0)
            {
                if (r != gPageRev) gLastHome = "";
                gPageRev = r;
            }
        }
        gRevDone = TRUE;
        scheduleMoap();
    }

    http_request(key id, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            gCapPending = FALSE;
            string next = body;
            if (llGetSubString(next, -1, -1) != "/") next += "/";
            string prev = gCapUrl;
            if (prev != "" && prev != next) llReleaseURL(prev);
            gCapUrl = next;
            gCapRetry = 0;
            gCapRefreshAt = llGetUnixTime() + CAP_REFRESH_SEC;
            gLastClientAt = llGetUnixTime();
            llOwnerSay("Canasta scoreboard HTTP-IN ready. Free=" + (string)llGetFreeMemory());
            gLastHome = "";
            scheduleMoap();
            return;
        }
        if (method == URL_REQUEST_DENIED)
        {
            gCapPending = FALSE;
            if (gCapUrl != "")
            {
                gCapRefreshAt = llGetUnixTime() + CAP_REFRESH_SEC;
                return;
            }
            gLastHome = "";
            gCapRetry += 1;
            llOwnerSay("Canasta scoreboard HTTP-IN denied (" + (string)gCapRetry + ").");
            llSetTimerEvent(CAP_RETRY_SEC);
            return;
        }
        gLastClientAt = llGetUnixTime();
        string qs = llGetHTTPHeader(id, "x-query-string");
        string game = qparam(qs, "game");
        if (game == "") game = "c";
        // Core owns Experience refresh; HTTP only serves current LSD snapshot.
        sendJsonp(id, qparam(qs, "cb"), game);
    }
}
