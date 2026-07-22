#!/usr/bin/env python3
"""Apply company lifecycle workflow changes via HubSpot automation v4 PUT."""
import json
import os
import re
import urllib.error
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_token():
    for p in (
        os.path.join(SCRIPT_DIR, "../.env.local"),
        os.path.join(os.getcwd(), ".env.local"),
    ):
        try:
            with open(p) as f:
                m = re.search(r"HUBSPOT_ACCESS_TOKEN=(.+)", f.read())
                if m:
                    return m.group(1).strip()
        except OSError:
            continue
    raise SystemExit("HUBSPOT_ACCESS_TOKEN not found in .env.local")


TOKEN = load_token()
BASE = "https://api.hubapi.com/automation/v4/flows"

CL_REENGAGE_FROM_STAGES = [
    "subscriber",
    "lead",
    "marketingqualifiedlead",
    "salesqualifiedlead",
    "opportunity",
    "other",
    "1020959500",
    "1324949332",
]
SKIP_OPPORTUNITY_STAGES = ["customer", "1050035315", "1050035316"]


def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url} -> {e.code} {e.read().decode()}") from e


def get_flow(fid):
    return req("GET", f"{BASE}/{fid}")


def put_flow(flow):
    for k in ("createdAt", "updatedAt", "dataSources", "uuid"):
        flow.pop(k, None)
    return req("PUT", f"{BASE}/{flow['id']}", flow)


def main():
    print("--- 1) Auto-entry 1792351752 ---")
    wf1 = get_flow("1792351752")
    ref = wf1["enrollmentCriteria"]["refinementCriteria"]
    assoc = ref["filterBranches"][0]["filterBranches"][0]
    life = next(f for f in assoc["filters"] if f["property"] == "lifecyclestage")
    life["operation"] = {
        "operator": "IS_ANY_OF",
        "includeObjectsWithNoValueSet": False,
        "values": CL_REENGAGE_FROM_STAGES,
        "operationType": "ENUMERATION",
    }
    put_flow(wf1)
    print("OK")

    print("\n--- 2) Auto-exit 1792375197 ---")
    wf2 = get_flow("1792375197")
    ref2 = wf2["enrollmentCriteria"]["refinementCriteria"]
    assoc2 = ref2["filterBranches"][0]["filterBranches"][0]
    life2 = next(f for f in assoc2["filters"] if f["property"] == "lifecyclestage")
    life2["operation"] = {
        "operator": "IS_NONE_OF",
        "includeObjectsWithNoValueSet": True,
        "values": SKIP_OPPORTUNITY_STAGES,
        "operationType": "ENUMERATION",
    }
    put_flow(wf2)
    print("OK")

    print("\n--- 3) Closed Won 1640563895 -> company customer ---")
    wf3 = get_flow("1640563895")
    act2 = next(a for a in wf3["actions"] if a.get("actionId") == "2")
    act2["fields"]["value"]["staticValue"] = "customer"
    put_flow(wf3)
    print("OK")

    print("\n--- 4) Meeting workflow 1795728484 -> set company Opportunity ---")
    wf4 = get_flow("1795728484")
    wf4["nextAvailableActionId"] = "3"
    create = next(a for a in wf4["actions"] if a["actionId"] == "1")
    create["connection"] = {"edgeType": "STANDARD", "nextActionId": "2"}
    wf4["actions"].append(
        {
            "actionId": "2",
            "actionTypeVersion": 0,
            "actionTypeId": "0-5",
            "fields": {
                "property_name": "lifecyclestage",
                "association": {
                    "associationCategory": "HUBSPOT_DEFINED",
                    "associationTypeId": 188,
                },
                "value": {"staticValue": "opportunity", "type": "STATIC_VALUE"},
            },
            "type": "SINGLE_CONNECTION",
        }
    )
    put_flow(wf4)
    print("OK")

    print(
        """
--- Lead on company create ---
`lifecyclestage` is hubspot-defined; API cannot persist defaultValue.
In HubSpot UI: Settings -> Data management -> Objects -> Companies, or a Company workflow:
Record created -> if lifecycle empty -> set Lead.
"""
    )


if __name__ == "__main__":
    main()
