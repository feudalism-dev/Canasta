// Canasta — Display stub (Furware / prim books / spectator MOAP later)
// Drop on the SAME root prim as Canasta_Table.lsl (or a child in the linkset).
// Compile: Mono. See Docs/TABLE_DISPLAY.md
//
// Table → Display:
//   91001 EVENT  pipe  EVENT|player|team|rank|value|extra
//   91002 START  solo|n|seat|uids…  or  match|uids…
//   91003 RESET
// Display → Table:
//   91004 RESET_DONE

integer DISPLAY_CMD_EVENT = 91001;
integer DISPLAY_CMD_START = 91002;
integer DISPLAY_CMD_RESET = 91003;
integer DISPLAY_RSP_RESET_DONE = 91004;

integer DEBUG = FALSE;

integer debug(string m)
{
    if (DEBUG) llOwnerSay("CN DISPLAY: " + m);
    return TRUE;
}

idleAttract()
{
    // Later: Furware "Canasta & Hand and Foot" + brass attract.
    debug("attract / idle");
}

handleEvent(string pipe)
{
    // Later: parse EVENT and drive book prims / Furware / spectator MOAP.
    debug(pipe);
}

default
{
    state_entry()
    {
        idleAttract();
        llOwnerSay("Canasta display stub ready. Wire Furware/prims later (Docs/TABLE_DISPLAY.md).");
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == DISPLAY_CMD_RESET)
        {
            idleAttract();
            llMessageLinked(LINK_SET, DISPLAY_RSP_RESET_DONE, "", NULL_KEY);
            return;
        }
        if (num == DISPLAY_CMD_START)
        {
            debug("START " + str);
            return;
        }
        if (num == DISPLAY_CMD_EVENT)
        {
            handleEvent(str);
            return;
        }
    }
}
