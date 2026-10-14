// Parlor — purchase registration (Experience entitlement).
// Drop in the delivery box AND/OR the paid game table.
// Compile: Mono + Experience. Ship next-owner no-mod + no-transfer.
//
// =============================================================================
// >>> ONLY LINE YOU EDIT PER PRODUCT SKU <<<
//
// Change GRANT_FAMILY below to the family this product unlocks, then Save.
// Use the exact lowercase spelling from the right column:
//
//   Product / box you are packing     GRANT_FAMILY value
//   --------------------------------  ------------------
//   Canasta (Classic / H&F / …)       "canasta"
//   Rummy (Gin / Kalooki / …)         "rummy"
//   Rooster / Trick family            "trick"
//   Ichi                              "ichi"
//   Skippo                            "skippo"
//   Phase It                          "phaseit"
//   Yotsy                             "yotsy"
//
// Examples:
//   string GRANT_FAMILY = "canasta";
//   string GRANT_FAMILY = "rummy";
//   string GRANT_FAMILY = "trick";
//
// Free hub table: do NOT include this script (hub only reads entitlements).
// Idempotent: rezzing again if already registered is safe.
// =============================================================================

string GRANT_FAMILY = "canasta";

string XP_PREFIX = "cn.ent.";
integer XP_ERROR_KEY_NOT_FOUND = 3;

key gXpReq = NULL_KEY;
integer gXpStep = 0;
string gOldPayload = "";
string gMerged = "";
integer gBusy = FALSE;

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

string entKey()
{
    return XP_PREFIX + (string)llGetOwner();
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

integer familyInList(string csv, string fam)
{
    list parts = llParseString2List(csv, [","], []);
    integer i;
    integer n = llGetListLength(parts);
    for (i = 0; i < n; i++)
    {
        if (llList2String(parts, i) == fam) return TRUE;
    }
    return FALSE;
}

string mergePacked(string packed, string fam)
{
    string body = packedBody(packed);
    if (familyInList(body, fam)) return "v1|" + body;
    if (body == "") return "v1|" + fam;
    return "v1|" + body + "," + fam;
}

integer hasExperience()
{
    return (llGetListLength(llGetExperienceDetails(NULL_KEY)) > 0);
}

startRegister()
{
    string fam = normFamily(GRANT_FAMILY);
    if (fam == "")
    {
        llOwnerSay("Parlor Register: set GRANT_FAMILY to a known family name.");
        return;
    }
    if (!hasExperience())
    {
        llOwnerSay("Parlor Register: compile with Experience to store purchases.");
        return;
    }
    if (gBusy) return;
    gBusy = TRUE;
    gXpStep = 0;
    gOldPayload = "";
    gMerged = "";
    gXpReq = llReadKeyValue(entKey());
}

default
{
    state_entry()
    {
        llSetTimerEvent(2.0);
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    attach(key av)
    {
        if (av != NULL_KEY) llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER)
        {
            // New owner → register GRANT_FAMILY under their UUID (idempotent).
            llOwnerSay("Parlor Register: owner changed — registering for new owner.");
            llResetScript();
        }
    }

    timer()
    {
        llSetTimerEvent(0.0);
        startRegister();
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

        string fam = normFamily(GRANT_FAMILY);
        if (fam == "")
        {
            gBusy = FALSE;
            return;
        }

        if (gXpStep == 0)
        {
            string base = "";
            if (ok) base = payload;
            if (ok && familyInList(packedBody(base), fam))
            {
                llOwnerSay("Parlor: " + fam + " already registered.");
                gBusy = FALSE;
                return;
            }
            gMerged = mergePacked(base, fam);
            gOldPayload = payload;
            if (!ok && err == XP_ERROR_KEY_NOT_FOUND)
            {
                gXpStep = 1;
                gXpReq = llCreateKeyValue(entKey(), gMerged);
                return;
            }
            if (ok)
            {
                gXpStep = 1;
                gXpReq = llUpdateKeyValue(entKey(), gMerged, TRUE, gOldPayload);
                return;
            }
            llOwnerSay("Parlor Register: Experience read failed (" + (string)err + ").");
            gBusy = FALSE;
            return;
        }

        if (!ok)
        {
            gXpStep = 0;
            gXpReq = llReadKeyValue(entKey());
            return;
        }
        llOwnerSay("Parlor: registered " + fam + " for this account.");
        gBusy = FALSE;
    }
}
