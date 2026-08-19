// Canasta — Table Controller
// Drop in the game table root (same object as AVsitter).
// Handles: seat roster, HUD rez + Experience handshake, one-game lock.
// HTTP-IN JSONP is Canasta_Http.lsl (same prim). Compile: Mono + Experience.
// See Docs/SECOND_LIFE.md

integer AVSITTER_STAND = 90065;
integer AVSITTER_SITTER = 90070;

string HUD_OBJECT_NAME = "Canasta HUD";

integer DISPLAY_CMD_EVENT = 91001;
integer DISPLAY_CMD_START = 91002;
integer DISPLAY_CMD_RESET = 91003;
integer DISPLAY_RSP_RESET_DONE = 91004;
integer DISPLAY_CMD_CAP = 91005;
integer DISPLAY_CMD_NEED_CAP = 91006;
integer HTTP_CMD = 92001;

integer MAX_SEATS = 4;
float STAND_GRACE_SEC = 15.0;
integer RESET_TIMEOUT_SEC = 6;

list gSeatAv = [];
list gHudObj = [];
list gSeatName = [];
list gActive = [];

integer MODE_IDLE = 0;
integer MODE_SOLO = 1;
integer MODE_LOBBY = 2;
integer MODE_MATCH = 3;
integer MODE_RESETTING = 4;
integer gMode = 0;
key gSoloUid = NULL_KEY;
key gHostUid = NULL_KEY;
string gRoomCode = "";
list gJoined = [];

key gPendingHttp = NULL_KEY;
string gPendingCb = "";
string gPendingAction = "";
key gPendingUid = NULL_KEY;
integer gResetDeadline = 0;
integer gPendingPlayers = 1;

list gGraceAv = [];
list gGraceSeat = [];
list gGraceUntil = [];

string gCapUrl = "";
string gBoard = "";
integer gReadyTick = 0;
integer DEBUG = FALSE;

list gRezQueue = [];
list gHudReadyQueue = [];

integer debug(string m)
{
    if (DEBUG) llOwnerSay("CN TABLE: " + m);
    return TRUE;
}

integer tableChannel()
{
    return (integer)("0x" + llGetSubString((string)llGetKey(), 0, 7)) * -1;
}

integer commandChannel(key av)
{
    return (integer)("0x" + llGetSubString((string)av, -8, -1)) * -1;
}

integer initSeats()
{
    gSeatAv = [NULL_KEY, NULL_KEY, NULL_KEY, NULL_KEY];
    gSeatName = ["", "", "", ""];
    gActive = [FALSE, FALSE, FALSE, FALSE];
    gHudObj = [NULL_KEY, NULL_KEY, NULL_KEY, NULL_KEY];
    return TRUE;
}

integer seatOf(key av)
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (llList2Key(gSeatAv, i) == av) return i;
    }
    return -1;
}

integer seatedCount()
{
    integer n = 0;
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (llList2Key(gSeatAv, i) != NULL_KEY) n++;
    }
    return n;
}

integer activeCount()
{
    integer n = 0;
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (llList2Integer(gActive, i) && llList2Key(gSeatAv, i) != NULL_KEY) n++;
    }
    return n;
}

integer isJoined(key av)
{
    return llListFindList(gJoined, [av]) >= 0;
}

integer clearGraceFor(key av)
{
    integer idx = llListFindList(gGraceAv, [av]);
    if (idx < 0) return FALSE;
    gGraceAv = llDeleteSubList(gGraceAv, idx, idx);
    gGraceSeat = llDeleteSubList(gGraceSeat, idx, idx);
    gGraceUntil = llDeleteSubList(gGraceUntil, idx, idx);
    return TRUE;
}

string jsonEscape(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
}

string modeName()
{
    if (gMode == MODE_SOLO) return "solo";
    if (gMode == MODE_LOBBY) return "lobby";
    if (gMode == MODE_MATCH) return "match";
    if (gMode == MODE_RESETTING) return "resetting";
    return "idle";
}

string rosterJson()
{
    string s = "[";
    integer i;
    integer first = TRUE;
    for (i = 0; i < MAX_SEATS; i++)
    {
        key av = llList2Key(gSeatAv, i);
        if (av == NULL_KEY) jump cont;
        if (!first) s += ",";
        first = FALSE;
        s += "{"
            + "\"seat\":" + (string)i + ","
            + "\"uid\":\"" + (string)av + "\","
            + "\"name\":\"" + jsonEscape(llList2String(gSeatName, i)) + "\","
            + "\"active\":" + llList2String(["false", "true"], llList2Integer(gActive, i)) + ","
            + "\"joined\":" + llList2String(["false", "true"], isJoined(av))
            + "}";
        @cont;
    }
    s += "]";
    return s;
}

string statusJson(integer ok, string err)
{
    string j = "{"
        + "\"ok\":" + llList2String(["false", "true"], ok) + ","
        + "\"tableId\":\"" + (string)llGetKey() + "\","
        + "\"mode\":\"" + modeName() + "\","
        + "\"activeCount\":" + (string)activeCount() + ","
        + "\"seatedCount\":" + (string)seatedCount() + ","
        + "\"roomCode\":\"" + jsonEscape(gRoomCode) + "\","
        + "\"hostUid\":\"" + (string)gHostUid + "\","
        + "\"soloUid\":\"" + (string)gSoloUid + "\","
        + "\"roster\":" + rosterJson();
    if (err != "") j += ",\"error\":\"" + jsonEscape(err) + "\"";
    j += "}";
    return j;
}

pushStatus()
{
    llMessageLinked(LINK_THIS, HTTP_CMD, "STATUS|" + statusJson(TRUE, ""), NULL_KEY);
}

httpResp(key httpId, string cb, string json)
{
    if (httpId == NULL_KEY) return;
    llMessageLinked(LINK_THIS, HTTP_CMD, "RESP|" + cb + "|" + json, httpId);
    if (llSubStringIndex(json, "\"tableId\"") >= 0)
    {
        llMessageLinked(LINK_THIS, HTTP_CMD, "STATUS|" + json, NULL_KEY);
    }
}

replyJson(key httpId, string cb, string json)
{
    if (httpId == NULL_KEY) return;
    llMessageLinked(LINK_THIS, HTTP_CMD, "RESP|" + cb + "|" + json, httpId);
}

sendDisplayCap()
{
    if (gCapUrl == "") return;
    llMessageLinked(LINK_SET, DISPLAY_CMD_CAP, gCapUrl, NULL_KEY);
}

clearPendingHttp()
{
    gPendingHttp = NULL_KEY;
    gPendingCb = "";
    gPendingAction = "";
    gPendingUid = NULL_KEY;
    gResetDeadline = 0;
}

integer beginTrackReset(integer clearLock)
{
    if (clearLock)
    {
        gSoloUid = NULL_KEY;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [];
    }
    gMode = MODE_RESETTING;
    gResetDeadline = llGetUnixTime() + RESET_TIMEOUT_SEC;
    gBoard = "";
    llMessageLinked(LINK_SET, DISPLAY_CMD_RESET, "", NULL_KEY);
    pushStatus();
    debug("DISPLAY_CMD_RESET");
    return TRUE;
}

integer stashPending(key httpId, string cb, string action, key uid)
{
    gPendingHttp = httpId;
    gPendingCb = cb;
    gPendingAction = action;
    gPendingUid = uid;
    return TRUE;
}

string mintRoomCode()
{
    string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    string s = "";
    integer i;
    for (i = 0; i < 5; i++)
    {
        integer r = (integer)llFrand(llStringLength(alphabet));
        s += llGetSubString(alphabet, r, r);
    }
    return s;
}

integer sendHudDetach(key av, integer seat)
{
    string msg = "CN_DETACH|" + (string)llGetKey() + "|" + (string)av;
    if (av != NULL_KEY)
    {
        llRegionSayTo(av, commandChannel(av), msg);
        llRegionSay(tableChannel(), msg);
    }
    if (seat >= 0 && seat < MAX_SEATS)
    {
        key hud = llList2Key(gHudObj, seat);
        if (hud != NULL_KEY)
        {
            integer ch = 0;
            if (av != NULL_KEY) ch = commandChannel(av);
            llRegionSayTo(hud, ch, msg);
            gHudObj = llListReplaceList(gHudObj, [NULL_KEY], seat, seat);
        }
    }
    return TRUE;
}

string readyMessage(key av, integer seat)
{
    if (av == NULL_KEY || seat < 0 || seat >= MAX_SEATS) return "";
    return "CN_READY|"
        + (string)llGetKey() + "|"
        + (string)seat + "|"
        + (string)av + "|"
        + gCapUrl + "|"
        + llList2String(gSeatName, seat);
}

string sendReady(key av, integer seat)
{
    string msg = readyMessage(av, seat);
    if (msg == "") return "";
    llRegionSayTo(av, commandChannel(av), msg);
    return msg;
}

integer rezHudFor(key av, integer seat)
{
    if (av == NULL_KEY || seat < 0 || seat >= MAX_SEATS) return FALSE;
    if (llGetInventoryType(HUD_OBJECT_NAME) != INVENTORY_OBJECT)
    {
        llRegionSayTo(av, 0, "Canasta: HUD object missing from table inventory (" + HUD_OBJECT_NAME + ").");
        llOwnerSay("CRITICAL: Put \"" + HUD_OBJECT_NAME + "\" in the table inventory.");
        return FALSE;
    }
    integer ch = commandChannel(av);
    llRezObject(HUD_OBJECT_NAME, llGetPos() + <0.0, 0.0, 1.5>, ZERO_VECTOR, ZERO_ROTATION, ch);
    gRezQueue += [ch, av, seat];
    return TRUE;
}

integer queueHudReady(key hudId, integer ch, string msg)
{
    integer wasEmpty = (llGetListLength(gHudReadyQueue) == 0);
    gHudReadyQueue += [hudId, ch, msg];
    if (wasEmpty) llSetTimerEvent(0.35);
    return TRUE;
}

integer pumpHudReadyQueue()
{
    while (llGetListLength(gHudReadyQueue) >= 3)
    {
        key hudId = llList2Key(gHudReadyQueue, 0);
        integer ch = llList2Integer(gHudReadyQueue, 1);
        string msg = llList2String(gHudReadyQueue, 2);
        gHudReadyQueue = llDeleteSubList(gHudReadyQueue, 0, 2);
        llRegionSayTo(hudId, ch, msg);
    }
    return TRUE;
}

integer announceAllSeated()
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        key av = llList2Key(gSeatAv, i);
        if (av != NULL_KEY) sendReady(av, i);
    }
    return TRUE;
}

integer releaseGameLock()
{
    if (gMode == MODE_IDLE || gMode == MODE_RESETTING)
    {
        gSoloUid = NULL_KEY;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [];
        return TRUE;
    }
    beginTrackReset(TRUE);
    return TRUE;
}

integer forfeitAvatar(key av)
{
    integer seat = seatOf(av);
    if (seat >= 0) gActive = llListReplaceList(gActive, [FALSE], seat, seat);
    integer j = llListFindList(gJoined, [av]);
    if (j >= 0) gJoined = llDeleteSubList(gJoined, j, j);

    if (gMode == MODE_SOLO && av == gSoloUid)
    {
        releaseGameLock();
        return TRUE;
    }
    if (gMode == MODE_LOBBY || gMode == MODE_MATCH)
    {
        if (av == gHostUid)
        {
            releaseGameLock();
            return TRUE;
        }
        if (gMode == MODE_MATCH && llGetListLength(gJoined) < 2) releaseGameLock();
    }
    pushStatus();
    return TRUE;
}

integer clearSeatRoster(integer seat)
{
    if (seat < 0 || seat >= MAX_SEATS) return FALSE;
    gSeatAv = llListReplaceList(gSeatAv, [NULL_KEY], seat, seat);
    gSeatName = llListReplaceList(gSeatName, [""], seat, seat);
    gActive = llListReplaceList(gActive, [FALSE], seat, seat);
    gHudObj = llListReplaceList(gHudObj, [NULL_KEY], seat, seat);
    return TRUE;
}

integer clearSeat(integer seat)
{
    if (seat < 0 || seat >= MAX_SEATS) return FALSE;
    key av = llList2Key(gSeatAv, seat);
    if (av != NULL_KEY)
    {
        sendHudDetach(av, seat);
        forfeitAvatar(av);
    }
    clearSeatRoster(seat);
    pushStatus();
    return TRUE;
}

integer onSit(key av, integer seat)
{
    if (seat < 0 || seat >= MAX_SEATS)
    {
        llRegionSayTo(av, 0, "Canasta: invalid seat.");
        return FALSE;
    }
    clearGraceFor(av);
    integer prev = seatOf(av);
    key old = llList2Key(gSeatAv, seat);
    if (prev == seat && old == av)
    {
        sendReady(av, seat);
        key hud = NULL_KEY;
        if (seat >= 0 && seat < MAX_SEATS) hud = llList2Key(gHudObj, seat);
        if (hud == NULL_KEY) rezHudFor(av, seat);
        return TRUE;
    }
    if (prev >= 0 && prev != seat) clearSeat(prev);
    if (old != NULL_KEY && old != av) clearSeat(seat);

    string nm = llGetDisplayName(av);
    if (nm == "") nm = llKey2Name(av);
    gSeatAv = llListReplaceList(gSeatAv, [av], seat, seat);
    gSeatName = llListReplaceList(gSeatName, [nm], seat, seat);
    gActive = llListReplaceList(gActive, [FALSE], seat, seat);
    rezHudFor(av, seat);
    llRegionSayTo(av, 0, "Canasta: HUD attaching — wait for table lobby.");
    pushStatus();
    return TRUE;
}

integer beginStandGrace(key av, integer seat)
{
    clearGraceFor(av);
    gGraceAv += [av];
    gGraceSeat += [seat];
    gGraceUntil += [llGetUnixTime() + (integer)STAND_GRACE_SEC];
    return TRUE;
}

integer processGrace()
{
    integer now = llGetUnixTime();
    integer i = 0;
    while (i < llGetListLength(gGraceAv))
    {
        if (llList2Integer(gGraceUntil, i) <= now)
        {
            key av = llList2Key(gGraceAv, i);
            integer seat = llList2Integer(gGraceSeat, i);
            gGraceAv = llDeleteSubList(gGraceAv, i, i);
            gGraceSeat = llDeleteSubList(gGraceSeat, i, i);
            gGraceUntil = llDeleteSubList(gGraceUntil, i, i);
            if (seatOf(av) == seat) clearSeat(seat);
        }
        else i++;
    }
    return TRUE;
}

string pipeSafe(string s)
{
    return llDumpList2String(llParseStringKeepNulls(s, ["|"], []), " ");
}

string seatUidPipe()
{
    string s = "";
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (i) s += "|";
        key av = llList2Key(gSeatAv, i);
        if (av != NULL_KEY) s += (string)av;
    }
    return s;
}

string seatNamePipe()
{
    string s = "";
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (i) s += "|";
        s += pipeSafe(llList2String(gSeatName, i));
    }
    return s;
}

string matchStartPayload()
{
    string s = "match";
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        s += "|";
        key av = llList2Key(gSeatAv, i);
        if (av != NULL_KEY && llListFindList(gJoined, [av]) >= 0) s += (string)av;
    }
    s += "|" + seatNamePipe();
    return s;
}

string soloStartPayload(key human, integer nPlayers)
{
    integer humanSeat = seatOf(human);
    if (humanSeat < 0) humanSeat = 0;
    if (nPlayers < 1) nPlayers = 1;
    if (nPlayers > MAX_SEATS) nPlayers = MAX_SEATS;
    return "solo|" + (string)nPlayers + "|" + (string)humanSeat + "|" + seatUidPipe() + "|" + seatNamePipe();
}

integer finishReset()
{
    string action = gPendingAction;
    key httpId = gPendingHttp;
    string cb = gPendingCb;
    key uid = gPendingUid;
    clearPendingHttp();

    if (action == "claim_solo")
    {
        gMode = MODE_SOLO;
        gSoloUid = uid;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [uid];
        llMessageLinked(LINK_SET, DISPLAY_CMD_START, soloStartPayload(uid, gPendingPlayers), NULL_KEY);
        gPendingPlayers = 1;
        httpResp(httpId, cb, statusJson(TRUE, ""));
        return TRUE;
    }
    if (action == "create")
    {
        gMode = MODE_LOBBY;
        gHostUid = uid;
        gSoloUid = NULL_KEY;
        gRoomCode = mintRoomCode();
        gJoined = [uid];
        httpResp(httpId, cb, statusJson(TRUE, ""));
        return TRUE;
    }
    if (action == "start")
    {
        gMode = MODE_MATCH;
        llMessageLinked(LINK_SET, DISPLAY_CMD_START, matchStartPayload(), NULL_KEY);
        httpResp(httpId, cb, statusJson(TRUE, ""));
        return TRUE;
    }
    gMode = MODE_IDLE;
    gSoloUid = NULL_KEY;
    gHostUid = NULL_KEY;
    gRoomCode = "";
    gJoined = [];
    gBoard = "";
    pushStatus();
    return TRUE;
}

integer requireSeatedActive(key uid, integer seatHint)
{
    integer seat = seatOf(uid);
    if (seat < 0) return -1;
    if (seatHint >= 0 && seatHint != seat) return -2;
    if (!llList2Integer(gActive, seat)) return -3;
    return seat;
}

handleHttpReq(key httpId, string cb, string action, key uid, integer seatHint, string pname, integer nPlayers, string payload)
{
    if (action == "board")
    {
        payload = llDumpList2String(llParseStringKeepNulls(payload, ["%7C"], []), "|");
        if (payload == "")
        {
            replyJson(httpId, cb, "{\"ok\":true,\"board\":\"" + jsonEscape(gBoard) + "\"}");
            return;
        }
        if (gMode == MODE_RESETTING)
        {
            replyJson(httpId, cb, "{\"ok\":false,\"error\":\"table resetting\"}");
            return;
        }
        if (gMode == MODE_SOLO)
        {
            if (uid != gSoloUid)
            {
                replyJson(httpId, cb, "{\"ok\":false,\"error\":\"only solo player emits\"}");
                return;
            }
        }
        else if (gMode == MODE_MATCH)
        {
            if (uid != gHostUid)
            {
                replyJson(httpId, cb, "{\"ok\":false,\"error\":\"only host emits\"}");
                return;
            }
        }
        else
        {
            replyJson(httpId, cb, "{\"ok\":false,\"error\":\"no active match\"}");
            return;
        }
        gBoard = payload;
        replyJson(httpId, cb, "{\"ok\":true}");
        return;
    }
    if (action == "enter")
    {
        integer seat = seatOf(uid);
        if (seat < 0)
        {
            httpResp(httpId, cb, statusJson(FALSE, "not seated"));
            return;
        }
        if (pname != "") gSeatName = llListReplaceList(gSeatName, [pname], seat, seat);
        gActive = llListReplaceList(gActive, [TRUE], seat, seat);
        httpResp(httpId, cb, statusJson(TRUE, ""));
        return;
    }
    if (action == "leave")
    {
        forfeitAvatar(uid);
        httpResp(httpId, cb, statusJson(TRUE, ""));
        return;
    }
    if (action == "claim_solo")
    {
        integer seat = requireSeatedActive(uid, seatHint);
        if (seat < 0)
        {
            httpResp(httpId, cb, statusJson(FALSE, "must be seated and active"));
            return;
        }
        if (gMode == MODE_RESETTING)
        {
            httpResp(httpId, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (gMode != MODE_IDLE)
        {
            httpResp(httpId, cb, statusJson(FALSE, "table busy"));
            return;
        }
        if (activeCount() > 1)
        {
            httpResp(httpId, cb, statusJson(FALSE, "other players are active — use multiplayer"));
            return;
        }
        if (nPlayers < 1) nPlayers = 1;
        if (nPlayers > MAX_SEATS) nPlayers = MAX_SEATS;
        gPendingPlayers = nPlayers;
        stashPending(httpId, cb, "claim_solo", uid);
        beginTrackReset(FALSE);
        return;
    }
    if (action == "end_game")
    {
        if (gMode == MODE_RESETTING)
        {
            httpResp(httpId, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (gMode == MODE_SOLO && uid != gSoloUid)
        {
            httpResp(httpId, cb, statusJson(FALSE, "not solo player"));
            return;
        }
        if ((gMode == MODE_LOBBY || gMode == MODE_MATCH) && uid != gHostUid && !isJoined(uid))
        {
            forfeitAvatar(uid);
            httpResp(httpId, cb, statusJson(TRUE, ""));
            return;
        }
        if (gMode == MODE_LOBBY || gMode == MODE_MATCH)
        {
            if (uid == gHostUid) releaseGameLock();
            else forfeitAvatar(uid);
        }
        else releaseGameLock();
        httpResp(httpId, cb, statusJson(TRUE, ""));
        return;
    }
    if (action == "create")
    {
        integer seat = requireSeatedActive(uid, seatHint);
        if (seat < 0)
        {
            httpResp(httpId, cb, statusJson(FALSE, "must be seated and active"));
            return;
        }
        if (gMode == MODE_RESETTING)
        {
            httpResp(httpId, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (gMode != MODE_IDLE)
        {
            httpResp(httpId, cb, statusJson(FALSE, "table busy"));
            return;
        }
        if (activeCount() < 2)
        {
            httpResp(httpId, cb, statusJson(FALSE, "need 2+ active players"));
            return;
        }
        stashPending(httpId, cb, "create", uid);
        beginTrackReset(FALSE);
        return;
    }
    if (action == "join")
    {
        integer seat = requireSeatedActive(uid, seatHint);
        if (seat < 0)
        {
            httpResp(httpId, cb, statusJson(FALSE, "must be seated and active"));
            return;
        }
        if (gMode != MODE_LOBBY)
        {
            httpResp(httpId, cb, statusJson(FALSE, "no open lobby"));
            return;
        }
        if (!isJoined(uid))
        {
            if (llGetListLength(gJoined) >= MAX_SEATS)
            {
                httpResp(httpId, cb, statusJson(FALSE, "lobby full"));
                return;
            }
            gJoined += [uid];
        }
        httpResp(httpId, cb, statusJson(TRUE, ""));
        return;
    }
    if (action == "start")
    {
        if (gMode == MODE_RESETTING)
        {
            httpResp(httpId, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (uid != gHostUid)
        {
            httpResp(httpId, cb, statusJson(FALSE, "only host can start"));
            return;
        }
        if (gMode != MODE_LOBBY)
        {
            httpResp(httpId, cb, statusJson(FALSE, "not in lobby"));
            return;
        }
        if (llGetListLength(gJoined) < 2)
        {
            httpResp(httpId, cb, statusJson(FALSE, "need at least 2 joined"));
            return;
        }
        stashPending(httpId, cb, "start", uid);
        beginTrackReset(FALSE);
        return;
    }
    if (action == "event")
    {
        if (payload == "")
        {
            httpResp(httpId, cb, "{\"ok\":false,\"error\":\"missing p\"}");
            return;
        }
        // Undo %7C encoding from Http transport
        payload = llDumpList2String(llParseStringKeepNulls(payload, ["%7C"], []), "|");
        if (gMode == MODE_RESETTING)
        {
            httpResp(httpId, cb, "{\"ok\":false,\"error\":\"table resetting\"}");
            return;
        }
        if (gMode == MODE_SOLO)
        {
            if (uid != gSoloUid)
            {
                httpResp(httpId, cb, "{\"ok\":false,\"error\":\"only solo player emits\"}");
                return;
            }
        }
        else if (gMode == MODE_MATCH)
        {
            if (uid != gHostUid)
            {
                httpResp(httpId, cb, "{\"ok\":false,\"error\":\"only host emits\"}");
                return;
            }
        }
        else
        {
            httpResp(httpId, cb, "{\"ok\":false,\"error\":\"no active match\"}");
            return;
        }
        llMessageLinked(LINK_SET, DISPLAY_CMD_EVENT, payload, NULL_KEY);
        replyJson(httpId, cb, "{\"ok\":true}");
        return;
    }
    httpResp(httpId, cb, statusJson(FALSE, "unknown action"));
}

default
{
    state_entry()
    {
        initSeats();
        clearPendingHttp();
        gMode = MODE_IDLE;
        gSoloUid = NULL_KEY;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [];
        gBoard = "";
        llListen(tableChannel(), "", NULL_KEY, "");
        llSetTimerEvent(2.0);
        pushStatus();
        llOwnerSay("Canasta table ready. Key=" + (string)llGetKey());
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == DISPLAY_RSP_RESET_DONE)
        {
            if (gMode == MODE_RESETTING) finishReset();
            return;
        }
        if (num == DISPLAY_CMD_NEED_CAP)
        {
            sendDisplayCap();
            return;
        }
        if (num == HTTP_CMD)
        {
            if (llGetSubString(str, 0, 3) == "CAP|")
            {
                gCapUrl = llGetSubString(str, 4, -1);
                sendDisplayCap();
                announceAllSeated();
                pushStatus();
                return;
            }
            if (llGetSubString(str, 0, 3) == "REQ|")
            {
                list parts = llParseStringKeepNulls(str, ["|"], []);
                // REQ|httpId|cb|action|uid|seat|name|players|p...
                key httpId = (key)llList2String(parts, 1);
                string cb = llList2String(parts, 2);
                string action = llList2String(parts, 3);
                key uid = (key)llList2String(parts, 4);
                string seatStr = llList2String(parts, 5);
                integer seatHint = -1;
                if (seatStr != "") seatHint = (integer)seatStr;
                string pname = llList2String(parts, 6);
                integer nPlayers = (integer)llList2String(parts, 7);
                string payload = "";
                integer i;
                for (i = 8; i < llGetListLength(parts); i++)
                {
                    if (i > 8) payload += "|";
                    payload += llList2String(parts, i);
                }
                if (uid == NULL_KEY && action != "status" && action != "board")
                {
                    httpResp(httpId, cb, statusJson(FALSE, "uid required"));
                    return;
                }
                handleHttpReq(httpId, cb, action, uid, seatHint, pname, nPlayers, payload);
                return;
            }
            return;
        }
        if (num == AVSITTER_SITTER)
        {
            onSit(id, (integer)str);
            return;
        }
        if (num == AVSITTER_STAND)
        {
            key av = id;
            integer seat = -1;
            if (av != NULL_KEY) seat = seatOf(av);
            if (seat < 0)
            {
                key fromStr = (key)str;
                if (fromStr != NULL_KEY)
                {
                    av = fromStr;
                    seat = seatOf(av);
                }
            }
            if (seat < 0)
            {
                integer s = (integer)str;
                if (s >= 0 && s < MAX_SEATS)
                {
                    seat = s;
                    if (av == NULL_KEY) av = llList2Key(gSeatAv, seat);
                }
            }
            sendHudDetach(av, seat);
            if (seat >= 0 && av != NULL_KEY)
            {
                if (gMode == MODE_SOLO && av == gSoloUid)
                {
                    clearGraceFor(av);
                    forfeitAvatar(av);
                    clearSeatRoster(seat);
                    pushStatus();
                    return;
                }
                if ((gMode == MODE_LOBBY || gMode == MODE_MATCH) && av == gHostUid)
                {
                    clearGraceFor(av);
                    forfeitAvatar(av);
                    clearSeatRoster(seat);
                    pushStatus();
                    return;
                }
            }
            beginStandGrace(av, seat);
            return;
        }
    }

    object_rez(key objId)
    {
        if (llGetListLength(gRezQueue) < 3) return;
        integer ch = llList2Integer(gRezQueue, 0);
        key av = llList2Key(gRezQueue, 1);
        integer seat = llList2Integer(gRezQueue, 2);
        gRezQueue = llDeleteSubList(gRezQueue, 0, 2);
        string msg = readyMessage(av, seat);
        if (msg == "") return;
        queueHudReady(objId, ch, msg);
        if (seat >= 0 && seat < MAX_SEATS)
        {
            gHudObj = llListReplaceList(gHudObj, [objId], seat, seat);
        }
    }

    listen(integer channel, string name, key id, string msg)
    {
        if (channel != tableChannel()) return;
        if (llGetSubString(msg, 0, 7) != "CN_HELLO") return;
        list parts = llParseStringKeepNulls(msg, ["|"], []);
        key uid = (key)llList2String(parts, 1);
        if (uid == NULL_KEY) uid = id;
        integer seat = seatOf(uid);
        if (seat < 0) return;
        sendReady(uid, seat);
    }

    timer()
    {
        pumpHudReadyQueue();
        if (llGetListLength(gHudReadyQueue) == 0) llSetTimerEvent(2.0);
        processGrace();
        if (gMode == MODE_RESETTING && gResetDeadline > 0)
        {
            if (llGetUnixTime() >= gResetDeadline)
            {
                debug("reset timeout — finishing");
                finishReset();
            }
        }
        gReadyTick++;
        if (gReadyTick >= 30)
        {
            gReadyTick = 0;
            announceAllSeated();
        }
    }
}
