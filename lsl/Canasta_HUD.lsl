// Canasta — HUD Bootloader
// Put this script ONLY in the HUD object in the table inventory ("Canasta HUD").
// Table rezzes it on sit; this script Experience-temp-attaches, then loads MoAP.
// Compile: Mono + same Experience as the table. See Docs/SECOND_LIFE.md

integer USE_DEV = FALSE;
string WEB_URL_PROD = "https://feudalism-dev.github.io/Canasta/";
string WEB_URL_DEV = "https://feudalism-dev.github.io/Canasta/";
// Bump when GitHub Pages deploys so MoAP reloads.
integer HUD_PAGE_ASSET_REV = 15;

integer HUD_FACE = 4;
integer HUD_MEDIA_PIXELS = 1024;
integer ATTACH_WAIT_SEC = 90;
integer DEBUG = FALSE;

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
    if (DEBUG) llOwnerSay("CN HUD: " + m);
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
        + "?tableId=" + llEscapeURL(gTableId)
        + "&seat=" + (string)gSeat
        + "&uid=" + llEscapeURL((string)gWearer)
        + "&name=" + llEscapeURL(gNameHint)
        + "&rev=" + (string)HUD_PAGE_ASSET_REV;
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

integer applyMoap(integer force)
{
    if (gWearer == NULL_KEY) return FALSE;
    if (gTableId == "")
    {
        debug("No tableId yet — waiting for CN_READY");
        return FALSE;
    }
    // Table JSONP needs HTTP-IN; don't paint a dead session without sl_cap.
    if (gSlCap == "")
    {
        gMoapPending = TRUE;
        debug("No sl_cap yet — waiting for table HTTP-IN URL");
        return FALSE;
    }

    string client = "hud";
    if (gParked) client = "";
    string home = sessionHome(gParked, client);

    // Skip clear/set when session params unchanged (avoids MoAP thrash).
    if (!force && home == gLastHomeUrl) return FALSE;

    string bust = (string)llGetUnixTime();
    string cur = home + "&cb=" + bust;

    debug("MoAP " + llGetSubString(cur, 0, 180));

    // Only clear when URL actually changes — ClearPrimMedia every tick blanked the viewer.
    list existing = llGetLinkMedia(LINK_THIS, HUD_FACE, [PRIM_MEDIA_CURRENT_URL]);
    if (llList2String(existing, 0) != cur)
    {
        llClearPrimMedia(HUD_FACE);
    }
    llSetPrimMediaParams(HUD_FACE, [
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_CURRENT_URL, cur,
        PRIM_MEDIA_HOME_URL, home,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, HUD_MEDIA_PIXELS,
        PRIM_MEDIA_HEIGHT_PIXELS, HUD_MEDIA_PIXELS,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER
    ]);
    gLastHomeUrl = home;
    return TRUE;
}

integer pollMediaHandoff()
{
    list existing = llGetLinkMedia(LINK_THIS, HUD_FACE, [PRIM_MEDIA_CURRENT_URL]);
    string cur = llList2String(existing, 0);
    if (cur == "") return FALSE;
    if (llSubStringIndex(cur, "action=browser") >= 0)
    {
        if (!gParked)
        {
            gParked = TRUE;
            string playUrl = sessionHome(FALSE, "browser");
            llLoadURL(gWearer, "Play Canasta in your web browser. Solo vs computer works here; multiplayer still uses this table.", playUrl);
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
    if (nm != "" && nm != gNameHint)
    {
        gNameHint = nm;
        dirty = TRUE;
    }
    return dirty;
}

integer handleReadyWhileWorn(string msg)
{
    integer dirty = storeReadyFields(msg);
    if (gWearer == NULL_KEY) gWearer = llGetOwner();
    if (gTargetAvatar != NULL_KEY && gWearer != gTargetAvatar)
    {
        debug("CN_READY uid mismatch — ignore");
        return FALSE;
    }
    gMoapPending = FALSE;
    // First load or real param change only — ignore periodic identical READY.
    // Do not unpark if the wearer is playing in an external browser.
    if (!gParked && (dirty || gLastHomeUrl == "")) applyMoap(TRUE);
    return TRUE;
}

integer beginAttachFromHandshake(string msg)
{
    storeReadyFields(msg);
    if (gTargetAvatar == NULL_KEY) return FALSE;

    // Already on the right avatar (manual wear / re-handshake).
    if (llGetAttached() && llGetOwner() == gTargetAvatar)
    {
        gPendingAttach = FALSE;
        gWearer = gTargetAvatar;
        dropHsListen();
        applyMoap(TRUE);
        return TRUE;
    }

    gPendingAttach = TRUE;
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
            gMoapPending = TRUE;
            llSetTimerEvent(3.0);
            llOwnerSay("Canasta HUD: waiting for table handshake…");
        }
        else
        {
            llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);
        }
    }

    on_rez(integer startParam)
    {
        if (startParam == 0)
        {
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
        gHsListen = llListen(gHsChan, "", NULL_KEY, "");
        llSetPrimitiveParams([PRIM_TEMP_ON_REZ, TRUE]);
        llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);
        llSetTimerEvent((float)ATTACH_WAIT_SEC);
        debug("rezzed; listening handshake ch=" + (string)gHsChan);
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

        if (llGetSubString(msg, 0, 7) != "CN_READY") return;

        // Rez handshake channel (before / during attach).
        if (gHsListen && channel == gHsChan)
        {
            beginAttachFromHandshake(msg);
            return;
        }

        // Command / table channel while worn.
        if (llGetAttached()) handleReadyWhileWorn(msg);
    }

    experience_permissions(key avId)
    {
        if (gPendingDetach)
        {
            llDetachFromAvatar();
            gPendingDetach = FALSE;
            return;
        }
        if (!gPendingAttach) return;
        if (avId != gTargetAvatar) return;
        llAttachToAvatarTemp(0);
    }

    experience_permissions_denied(key avId, integer reason)
    {
        if (gPendingDetach)
        {
            llRequestPermissions(llGetOwner(), PERMISSION_ATTACH);
            return;
        }
        if (!gPendingAttach) return;
        llRegionSayTo(avId, 0, "Canasta HUD auto-attach failed. Please accept attachment permissions.");
        llRequestPermissions(avId, PERMISSION_ATTACH);
        debug("Experience denied reason=" + (string)reason);
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
            clearListens();
            gWearer = NULL_KEY;
            gPendingAttach = FALSE;
            gPendingDetach = FALSE;
            llDie();
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
        if (gCmdListen) llListenRemove(gCmdListen);
        gCmdListen = llListen(commandChannel(gWearer), "", NULL_KEY, "");
        dropHsListen();
        llSetTimerEvent(3.0);
        gHelloTicks = 0;
        llOwnerSay("Canasta HUD attached — click Enter Table when ready.");
        if (gTableId != "")
        {
            applyMoap(TRUE);
            gResyncLeft = 1;
            sayHello();
        }
        else
        {
            gMoapPending = TRUE;
        }
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
            llRegionSayTo(gTargetAvatar, 0, "Canasta HUD attach timed out. Stand and sit again.");
            llDie();
            return;
        }

        if (gWearer == NULL_KEY || !llGetAttached())
        {
            llSetTimerEvent(0.0);
            return;
        }

        // Keep trying hello until we have sl_cap + MoAP, then a few extras.
        if (gSlCap == "" || gLastHomeUrl == "")
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

        if (gMoapPending && gTableId != "" && gSlCap != "")
        {
            gMoapPending = FALSE;
            applyMoap(TRUE);
            gResyncLeft = 1;
        }
        // Exactly one CEF resync after first paint — never re-arms.
        if (gResyncLeft > 0 && gTableId != "")
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
