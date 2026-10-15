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
//   Row! Sham! Bo!                    "rowshambo"
//
// Free hub table: do NOT include this script (hub only reads entitlements).
// Idempotent: rezzing again if already registered is safe.
// =============================================================================

string GRANT_FAMILY = "canasta";

string XP_PREFIX = "cn.ent.";
// XP_ERROR_KEY_NOT_FOUND is a built-in Experience constant — do not redeclare.

key gXpReq = NULL_KEY;
integer gXpStep = 0;
string gOldPayload = "";
string gMerged = "";
integer gBusy = FALSE;
integer gRetries = 0;
integer MAX_RETRIES = 4;

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
    if (raw == "rowshambo" || raw == "rsb" || raw == "row-sham-bo" || raw == "row_sham_bo") return "rowshambo";
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

// Experience dataserver: "1,<value>" or "0,<errcode>".
// Value may contain commas (v1|canasta,rummy) — NEVER use llCSV2List.
integer gXpOk = FALSE;
string gXpRest = "";

takeXpReply(string data)
{
    gXpOk = FALSE;
    gXpRest = "";
    integer comma = llSubStringIndex(data, ",");
    if (comma < 0)
    {
        gXpOk = (integer)data;
        return;
    }
    gXpOk = (integer)llGetSubString(data, 0, comma - 1);
    gXpRest = llGetSubString(data, comma + 1, -1);
}

startRegister()
{
    string fam = normFamily(GRANT_FAMILY);
    if (fam == "")
    {
        llOwnerSay("Parlor Register: set GRANT_FAMILY to a known family name (got \"" + GRANT_FAMILY + "\").");
        return;
    }
    if (!hasExperience())
    {
        llOwnerSay("Parlor Register: compile with Experience to store purchases.");
        return;
    }
    if (gBusy)
    {
        llOwnerSay("Parlor Register: still working…");
        return;
    }
    gBusy = TRUE;
    gXpStep = 0;
    gRetries = 0;
    gOldPayload = "";
    gMerged = "";
    llOwnerSay("Parlor Register: looking up " + fam + " for " + llKey2Name(llGetOwner()) + "…");
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
        takeXpReply(data);

        string fam = normFamily(GRANT_FAMILY);
        if (fam == "")
        {
            gBusy = FALSE;
            return;
        }

        if (gXpStep == 0)
        {
            string base = "";
            if (gXpOk) base = gXpRest;
            if (gXpOk && familyInList(packedBody(base), fam))
            {
                llOwnerSay("Parlor: " + fam + " already registered (" + base + "). You may remove or pick up this HUD/box.");
                gBusy = FALSE;
                return;
            }
            gMerged = mergePacked(base, fam);
            gOldPayload = base;
            if (!gXpOk && ((integer)gXpRest == XP_ERROR_KEY_NOT_FOUND))
            {
                gXpStep = 1;
                llOwnerSay("Parlor Register: creating " + gMerged);
                gXpReq = llCreateKeyValue(entKey(), gMerged);
                return;
            }
            if (gXpOk)
            {
                gXpStep = 1;
                llOwnerSay("Parlor Register: updating " + base + " → " + gMerged);
                gXpReq = llUpdateKeyValue(entKey(), gMerged, TRUE, gOldPayload);
                return;
            }
            llOwnerSay("Parlor Register: Experience read failed (err " + gXpRest + ").");
            gBusy = FALSE;
            return;
        }

        // Step 1 — create/update result
        if (!gXpOk)
        {
            gRetries += 1;
            if (gRetries > MAX_RETRIES)
            {
                llOwnerSay("Parlor Register: update failed after retries (err " + gXpRest + "). Try again.");
                gBusy = FALSE;
                return;
            }
            // Lost race / stale check — re-read and merge again.
            llOwnerSay("Parlor Register: retry " + (string)gRetries + "…");
            gXpStep = 0;
            gXpReq = llReadKeyValue(entKey());
            return;
        }
        llOwnerSay("Parlor: registered " + fam + " (" + gMerged + "). You may remove or pick up this HUD/box.");
        gBusy = FALSE;
    }
}
