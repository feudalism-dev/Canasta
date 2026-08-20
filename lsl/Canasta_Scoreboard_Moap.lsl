// Canasta — scoreboard SCREEN MoAP applicator.
// Drop on the child prim named "screen". Compile: Mono.
// Core (frame) sends link 93003: "<force>\n<homeUrl>"
// Uses llSetPrimMediaParams on THIS prim (same pattern as Canasta_Display).

integer MOAP_CMD = 93003;
integer MEDIA_FACE = 0;
integer MEDIA_W = 1024;
integer MEDIA_H = 720;

string gLastHome = "";

integer applyLocal(integer force, string home)
{
    if (home == "") return FALSE;
    if (!force && home == gLastHome) return FALSE;

    string cur = home;
    if (force) cur = home + "&cb=" + (string)llGetUnixTime();

    if (force)
    {
        llClearPrimMedia(MEDIA_FACE);
    }
    llSetPrimMediaParams(MEDIA_FACE, [
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_CURRENT_URL, cur,
        PRIM_MEDIA_HOME_URL, home,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, MEDIA_W,
        PRIM_MEDIA_HEIGHT_PIXELS, MEDIA_H,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE
    ]);
    gLastHome = home;
    return TRUE;
}

default
{
    state_entry()
    {
        llOwnerSay("Canasta scoreboard MoAP ready on screen.");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION_START)
        {
            gLastHome = "";
        }
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num != MOAP_CMD) return;
        list p = llParseStringKeepNulls(str, ["\n"], []);
        if (llGetListLength(p) < 2) return;
        integer force = (integer)llList2String(p, 0);
        string home = llList2String(p, 1);
        integer i;
        for (i = 2; i < llGetListLength(p); i++)
        {
            home += "\n" + llList2String(p, i);
        }
        applyLocal(force, home);
    }
}
