// Canasta — HUD Bootloader
// Put this script ONLY in the HUD object in the table inventory ("Canasta HUD").
// Table rezzes it on sit; this script Experience-temp-attaches, then loads MoAP.
// Compile: Mono + same Experience as the table. See Docs/SECOND_LIFE.md

integer USE_DEV = FALSE;
string WEB_URL_PROD = "https://feudalism-dev.github.io/Canasta/";
string WEB_URL_DEV = "https://feudalism-dev.github.io/Canasta/";
// Bump when GitHub Pages deploys so MoAP reloads.
integer HUD_PAGE_ASSET_REV = 34;

integer HUD_FACE = 4;
integer HUD_MEDIA_PIXELS = 1024;
integer ATTACH_WAIT_SEC = 90;
integer DEBUG = TRUE;

integer gHsChan = 0;
integer gHsListen = 0;
integer gCmdListen = 0;
integer gTableListen = 0;

key gWearer = NULL_KEY;
key gTargetAvatar = NULL_KEY;
string gTableId = "";
integer gSeat = -1;
string gSlCap = "";
string gNameHint = "";

integer gPendingAttach = FALSE;
integer gPendingDetach = FALSE;
integer gMoapPending = FALSE;
integer gParked = FALSE;
integer gFromTableRez = FALSE;
integer gDetachTries = 0;
integer gResyncLeft = 0;
string gLastHomeUrl = "";
integer gHelloTicks = 0;

integer debug(string m)
{
    if (!DEBUG) return FALSE;
    llOwnerSay("CN HUD: " + m);
    if (gTargetAvatar != NULL_KEY && gTargetAvatar != llGetOwner())
    {
        llRegionSayTo(gTargetAvatar, 0, "CN HUD: " + m);
    }
    return TRUE;
}

integer commandChannel(key av)
{
    return (integer)("0x" + llGetSubString((string)av, -8, -1)) * -1;
}

integer tableChannelFromId(string tableId)
{
    if (tableId == "") return 0;
    return (integer)("0x" + llGetSubString(tableId, 0, 7)) * -1;
}

string webBase()
{
    if (USE_DEV) return WEB_URL_DEV;
    return WEB_URL_PROD;
}

integer clearListens()
{
    if (gHsListen)
    {
        llListenRemove(gHsListen);
        gHsListen = 0;
    }
    if (gCmdListen)
    {
        llListenRemove(gCmdListen);
        gCmdListen = 0;
    }
    if (gTableListen)
    {
        llListenRemove(gTableListen);
        gTableListen = 0;
    }
    return TRUE;
}

integer dropHsListen()
{
    if (gHsListen)
    {
        llListenRemove(gHsListen);
        gHsListen = 0;
    }
    return TRUE;
}

integer sayHello()
{
    if (gWearer == NULL_KEY) return FALSE;
    if (gTableId == "") return FALSE;
    integer ch = tableChannelFromId(gTableId);
    if (ch == 0) return FALSE;
    llRegionSay(ch, "CN_HELLO|" + (string)gWearer);
    return TRUE;
}

string sessionHome(integer parked, string client)
{
    string home = webBase()
        + "?tableId=" + gTableId
        + "&seat=" + (string)gSeat
        + "&uid=" + (string)gWearer
        + "&rev=" + (string)HUD_PAGE_ASSET_REV;
    if (gNameHint != "") home += "&name=" + llEscapeURL(gNameHint);
    home += "&sl_cap=" + llEscapeURL(gSlCap);
    if (parked)
    {
        home += "&parked=1";
    }
    else if (client != "")
    {
        home += "&client=" + client;
    }
    return home;
}

string standalonePlayUrl()
{
    string home = webBase()
        + "?client=web"
        + "&rev=" + (string)HUD_PAGE_ASSET_REV;
    if (gNameHint != "") home += "&name=" + llEscapeURL(gNameHint);
    return home;
}

integer applyMoap(integer force)
{
    if (gWearer == NULL_KEY)
    {
        debug("MoAP skip — no wearer");
        return FALSE;
    }
    if (gTableId == "")
    {
        debug("MoAP skip — no tableId");
        return FALSE;
    }

    string client = "hud";
    if (gParked) client = "";
    string home = sessionHome(gParked, client);

    list existing = llGetLinkMedia(LINK_THIS, HUD_FACE, [PRIM_MEDIA_CURRENT_URL]);
    string existingUrl = llList2String(existing, 0);
    integer hasMedia = FALSE;
    if (existingUrl != "") hasMedia = TRUE;
    integer firstPaint = FALSE;
    if (gLastHomeUrl == "") firstPaint = TRUE;
    integer sameHome = FALSE;
    if (home == gLastHomeUrl) sameHome = TRUE;

    // Do not ClearPrimMedia here — clear+set in one event often returns OK
    // while the HUD CEF never starts. Just set the URL.
    if (!firstPaint && sameHome && hasMedia && !force)
    {
        debug("MoAP skip — same session already painted");
        return FALSE;
    }

    string cur = home + "&cb=" + (string)llGetUnixTime();
    debug("MoAP set face=" + (string)HUD_FACE + " caplen=" + (string)llStringLength(gSlCap)
        + " parked=" + (string)gParked + " " + llGetSubString(cur, 0, 140));

    integer st = llSetPrimMediaParams(HUD_FACE, [
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_CURRENT_URL, cur,
        PRIM_MEDIA_HOME_URL, home,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, HUD_MEDIA_PIXELS,
        PRIM_MEDIA_HEIGHT_PIXELS, HUD_MEDIA_PIXELS,
        PRIM_MEDIA_WHITELIST_ENABLE, FALSE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER
    ]);
    list check = llGetLinkMedia(LINK_THIS, HUD_FACE, [PRIM_MEDIA_CURRENT_URL]);
    debug("MoAP status=" + (string)st + " now=" + llGetSubString(llList2String(check, 0), 0, 80));
    gLastHomeUrl = home;
    return TRUE;
}

integer pollMediaHandoff()
{
    // Ignore leftover inventory media until this attach has painted a session.
    if (gLastHomeUrl == "") return FALSE;
    list existing = llGetLinkMedia(LINK_THIS, HUD_FACE, [PRIM_MEDIA_CURRENT_URL]);
    string cur = llList2String(existing, 0);
    if (cur == "") return FALSE;
    if (llSubStringIndex(cur, "action=browser") >= 0)
    {
        if (!gParked)
        {
            gParked = TRUE;
            string playUrl = standalonePlayUrl();
            llLoadURL(gWearer, "Play Hand and Foot / Canasta in your web browser. This is a solo game on the web. Multiplayer still uses this table HUD.", playUrl);
            applyMoap(TRUE);
            llOwnerSay("Canasta HUD parked. Play in your browser, or Return to HUD from the parked screen.");
        }
        return TRUE;
    }
    if (llSubStringIndex(cur, "action=hud") >= 0)
    {
        if (gParked)
        {
            gParked = FALSE;
            applyMoap(TRUE);
            llOwnerSay("Canasta HUD restored.");
        }
        return TRUE;
    }
    return FALSE;
}

integer storeReadyFields(string msg)
{
    // CN_READY|tableId|seat|uid|slCap|displayName
    // Returns TRUE if session fields changed (MoAP should reload).
    list p = llParseStringKeepNulls(msg, ["|"], []);
    if (llList2String(p, 0) != "CN_READY") return FALSE;
    string tableId = llList2String(p, 1);
    integer seat = (integer)llList2String(p, 2);
    key uid = (key)llList2String(p, 3);
    string cap = llList2String(p, 4);
    string nm = llList2String(p, 5);

    integer dirty = FALSE;
    if (uid != NULL_KEY && uid != gTargetAvatar)
    {
        gTargetAvatar = uid;
        dirty = TRUE;
    }
    if (tableId != "" && tableId != gTableId)
    {
        gTableId = tableId;
        dirty = TRUE;
        if (gTableListen)
        {
            llListenRemove(gTableListen);
            gTableListen = 0;
        }
        integer tch = tableChannelFromId(gTableId);
        if (tch != 0) gTableListen = llListen(tch, "", NULL_KEY, "");
    }
    if (seat != gSeat)
    {
        gSeat = seat;
        dirty = TRUE;
    }
    if (cap != "" && cap != gSlCap)
    {
        gSlCap = cap;
        dirty = TRUE;
    }
    if (gNameHint == "" && nm != "") gNameHint = nm;
    return dirty;
}

integer handleReadyWhileWorn(string msg)
{
    integer dirty = storeReadyFields(msg);
    if (gWearer == NULL_KEY) gWearer = llGetOwner();
    if (gTargetAvatar != NULL_KEY && gWearer != gTargetAvatar)
    {
        debug("CN_READY uid mismatch wearer=" + (string)gWearer + " uid=" + (string)gTargetAvatar);
        return FALSE;
    }
    debug("READY worn dirty=" + (string)dirty + " parked=" + (string)gParked
        + " home=" + (string)(gLastHomeUrl != "") + " caplen=" + (string)llStringLength(gSlCap));
    // First paint always — a saved Play-in-Browser park flag on the inventory
    // object must not skip llSetPrimMediaParams.
    if (gLastHomeUrl == "")
    {
        applyMoap(TRUE);
        return TRUE;
    }
    if (!gParked && dirty) applyMoap(TRUE);
    return TRUE;
}

integer beginAttachFromHandshake(string msg)
{
    storeReadyFields(msg);
    debug("handshake table=" + llGetSubString(gTableId, 0, 7) + " seat=" + (string)gSeat
        + " caplen=" + (string)llStringLength(gSlCap) + " target=" + (string)gTargetAvatar
        + " attached=" + (string)llGetAttached());
    if (gTargetAvatar == NULL_KEY)
    {
        debug("handshake abort — no target uid");
        return FALSE;
    }

    // Already on the right avatar (manual wear / re-handshake).
    if (llGetAttached() && llGetOwner() == gTargetAvatar)
    {
        gPendingAttach = FALSE;
        gWearer = gTargetAvatar;
        dropHsListen();
        debug("already attached — paint");
        applyMoap(TRUE);
        return TRUE;
    }

    if (gPendingAttach)
    {
        debug("handshake ignore — attach already pending");
        return TRUE;
    }

    gPendingAttach = TRUE;
    debug("request Experience attach");
    llSetTimerEvent((float)ATTACH_WAIT_SEC);
    llRequestExperiencePermissions(gTargetAvatar, "");
    return TRUE;
}

integer initiateDetach()
{
    if (gPendingDetach) return TRUE;
    gPendingDetach = TRUE;
    gPendingAttach = FALSE;
    gDetachTries = 0;
    llClearPrimMedia(HUD_FACE);
    if (!llGetAttached())
    {
        llDie();
        return TRUE;
    }
    // Do not wait for a second Experience grant — that event often does not fire
    // when permission is already held from temp-attach.
    llDetachFromAvatar();
    llRequestPermissions(llGetOwner(), PERMISSION_ATTACH);
    llRequestExperiencePermissions(llGetOwner(), "");
    llSetTimerEvent(0.5);
    return TRUE;
}

default
{
    state_entry()
    {
        // Manual wear fallback (already attached from inventory).
        if (llGetAttached())
        {
            gWearer = llGetOwner();
            gTargetAvatar = gWearer;
            gCmdListen = llListen(commandChannel(gWearer), "", NULL_KEY, "");
            gParked = FALSE;
            gMoapPending = TRUE;
            llSetTimerEvent(3.0);
            llOwnerSay("Canasta HUD: waiting for table handshake…");
            debug("state_entry attached");
        }
        else
        {
            if (!DEBUG) llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);
            else llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES);
            debug("state_entry unattached id=" + (string)llGetKey());
        }
    }

    on_rez(integer startParam)
    {
        if (startParam == 0)
        {
            debug("on_rez startParam=0 attached=" + (string)llGetAttached());
            llSetPrimitiveParams([PRIM_TEMP_ON_REZ, FALSE]);
            if (!llGetAttached()) llResetScript();
            return;
        }
        clearListens();
        gHsChan = startParam;
        gPendingAttach = FALSE;
        gPendingDetach = FALSE;
        gFromTableRez = TRUE;
        gDetachTries = 0;
        gTableId = "";
        gSeat = -1;
        gSlCap = "";
        gNameHint = "";
        gTargetAvatar = NULL_KEY;
        gLastHomeUrl = "";
        gHelloTicks = 0;
        gResyncLeft = 0;
        gParked = FALSE;
        gMoapPending = FALSE;
        gWearer = NULL_KEY;
        // Listen before any delay (ClearPrimMedia / SetPrimitiveParams). Missing
        // CN_READY means no attach, and TEMP_ON_REZ then silently dies.
        gHsListen = llListen(gHsChan, "", NULL_KEY, "");
        llSetPrimitiveParams([PRIM_TEMP_ON_REZ, TRUE]);
        llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES);
        llSetTimerEvent((float)ATTACH_WAIT_SEC);
        debug("on_rez param=" + (string)startParam + " listen=" + (string)gHsListen
            + " id=" + (string)llGetKey() + " mem=" + (string)llGetFreeMemory());
    }

    listen(integer channel, string name, key id, string msg)
    {
        if (llGetSubString(msg, 0, 8) == "CN_DETACH")
        {
            list p = llParseStringKeepNulls(msg, ["|"], []);
            string tid = llList2String(p, 1);
            string who = llList2String(p, 2);
            if (tid != "" && gTableId != "" && tid != gTableId) return;
            if (who != "")
            {
                key target = (key)who;
                if (target != NULL_KEY)
                {
                    if (target != gWearer && target != gTargetAvatar && target != llGetOwner()) return;
                }
            }
            llOwnerSay("Left the Canasta table.");
            initiateDetach();
            return;
        }

        if (llGetSubString(msg, 0, 7) != "CN_READY")
        {
            debug("ignore ch=" + (string)channel + " " + llGetSubString(msg, 0, 40));
            return;
        }
        debug("CN_READY ch=" + (string)channel + " hs=" + (string)gHsChan
            + " attached=" + (string)llGetAttached() + " " + llGetSubString(msg, 0, 96));

        // Rez handshake channel (before / during attach).
        if (gHsListen && channel == gHsChan)
        {
            beginAttachFromHandshake(msg);
            return;
        }

        // Command / table channel while worn.
        if (llGetAttached())
        {
            handleReadyWhileWorn(msg);
            return;
        }
        debug("CN_READY dropped — ch=" + (string)channel + " hsListen=" + (string)gHsListen);
    }

    experience_permissions(key avId)
    {
        debug("xp grant av=" + (string)avId + " pendingAttach=" + (string)gPendingAttach
            + " pendingDetach=" + (string)gPendingDetach);
        if (gPendingDetach)
        {
            llDetachFromAvatar();
            gPendingDetach = FALSE;
            return;
        }
        if (!gPendingAttach)
        {
            debug("xp grant ignored — not pending attach");
            return;
        }
        if (avId != gTargetAvatar)
        {
            debug("xp grant ignored — wrong av");
            return;
        }
        debug("llAttachToAvatarTemp");
        llAttachToAvatarTemp(0);
    }

    experience_permissions_denied(key avId, integer reason)
    {
        if (gPendingDetach)
        {
            llRequestPermissions(llGetOwner(), PERMISSION_ATTACH);
            return;
        }
        debug("xp denied av=" + (string)avId + " reason=" + (string)reason
            + " pendingAttach=" + (string)gPendingAttach);
        if (!gPendingAttach) return;
        llRegionSayTo(avId, 0, "Canasta HUD auto-attach failed. Please accept attachment permissions.");
        llRequestPermissions(avId, PERMISSION_ATTACH);
    }

    run_time_permissions(integer perm)
    {
        if (gPendingDetach)
        {
            if (perm & PERMISSION_ATTACH) llDetachFromAvatar();
            gPendingDetach = FALSE;
            return;
        }
        if (!gPendingAttach) return;
        debug("runtime perm=" + (string)perm);
        if (perm & PERMISSION_ATTACH)
        {
            llAttachToAvatarTemp(0);
        }
        else
        {
            llRegionSayTo(gTargetAvatar, 0, "Canasta HUD permission denied — stand and sit again.");
            llDie();
        }
    }

    attach(key id)
    {
        if (id == NULL_KEY)
        {
            debug("detach fromTable=" + (string)gFromTableRez);
            clearListens();
            gWearer = NULL_KEY;
            gPendingAttach = FALSE;
            gPendingDetach = FALSE;
            if (gFromTableRez) llDie();
            return;
        }

        gPendingAttach = FALSE;
        if (gTargetAvatar == NULL_KEY) gTargetAvatar = id;
        if (gTargetAvatar != NULL_KEY && id != gTargetAvatar)
        {
            llOwnerSay("Canasta HUD: wrong wearer — removing.");
            llDie();
            return;
        }

        gWearer = id;
        llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES);
        gLastHomeUrl = "";
        gParked = FALSE;
        if (gCmdListen) llListenRemove(gCmdListen);
        gCmdListen = llListen(commandChannel(gWearer), "", NULL_KEY, "");
        dropHsListen();
        gHelloTicks = 0;
        gMoapPending = TRUE;
        gResyncLeft = 1;
        llSetTimerEvent(0.5);
        llOwnerSay("Canasta HUD attached — click Enter Table when ready.");
        debug("attached table=" + llGetSubString(gTableId, 0, 7) + " seat=" + (string)gSeat
            + " caplen=" + (string)llStringLength(gSlCap) + " parked=" + (string)gParked
            + " — media on next timer");
        if (gTableId != "") sayHello();
    }

    timer()
    {
        if (gPendingDetach)
        {
            gDetachTries++;
            if (!llGetAttached())
            {
                llDie();
                return;
            }
            llDetachFromAvatar();
            if (gFromTableRez && gDetachTries >= 3)
            {
                llDie();
            }
            if (gDetachTries >= 8)
            {
                llSetTimerEvent(0.0);
            }
            return;
        }

        if (gPendingAttach && llGetAttached() == 0)
        {
            debug("attach timed out");
            llRegionSayTo(gTargetAvatar, 0, "Canasta HUD attach timed out. Stand and sit again.");
            llDie();
            return;
        }

        if (gWearer == NULL_KEY || !llGetAttached())
        {
            llSetTimerEvent(0.0);
            return;
        }

        // Hello until we have sl_cap, then a few extras. Do not spam forever.
        if (gSlCap == "" && gTableId != "")
        {
            if (gHelloTicks < 8)
            {
                gHelloTicks++;
                sayHello();
            }
            llSetTimerEvent(4.0);
        }
        else if (gLastHomeUrl == "")
        {
            if (gTableId != "") sayHello();
            llSetTimerEvent(2.0);
        }
        else if (gHelloTicks < 3)
        {
            gHelloTicks++;
            sayHello();
            llSetTimerEvent(3.0);
        }
        else
        {
            llSetTimerEvent(4.0);
        }

        if (gMoapPending && gTableId != "")
        {
            gMoapPending = FALSE;
            applyMoap(TRUE);
            gResyncLeft = 1;
        }
        else if (gResyncLeft > 0 && gTableId != "")
        {
            gResyncLeft = 0;
            applyMoap(TRUE);
        }
        pollMediaHandoff();
        if (gParked) llSetTimerEvent(3.0);
    }

    changed(integer change)
    {
        if (change & (CHANGED_REGION | CHANGED_TELEPORT))
        {
            llClearPrimMedia(HUD_FACE);
            llOwnerSay("Region change — Canasta HUD detaching.");
            initiateDetach();
        }
    }
}
