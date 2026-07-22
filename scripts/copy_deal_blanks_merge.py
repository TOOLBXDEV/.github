#!/usr/bin/env python3
"""
Copy non-blank values from deal B onto deal A where A is blank, then optionally merge B into A.

Usage:
  python3 copy_deal_blanks_merge.py              # dry-run (list PATCH keys)
  python3 copy_deal_blanks_merge.py --patch
  python3 copy_deal_blanks_merge.py --merge    # after patch; or --merge-only

If merge returns 400 association limits, remove extra deal-company/contact links in HubSpot UI, then merge from the deal record (Actions > Merge).

Requires HUBSPOT_ACCESS_TOKEN in toolbx-sales-hub/.env.local
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DEAL_A = "58134947431"
DEFAULT_DEAL_B = "57978120727"

# Never copy these (identity, system, or plan exclusions for amount/stage/owner).
EXCLUDE_NAMES = frozenset(
    {
        "hs_object_id",
        "hs_object_source",
        "hs_object_source_id",
        "hs_object_source_detail_1",
        "hs_object_source_detail_2",
        "hs_object_source_detail_3",
        "hs_object_source_label",
        "createdate",
        "hs_createdate",
        "hs_merged_object_ids",
        "hs_lastmodifieddate",
        "hs_created_by_user_id",
        "hs_updated_by_user_id",
        # Plan: do not overwrite funnel / money from B
        "amount",
        "dealstage",
        "pipeline",
        "closedate",
        "hubspot_owner_id",
        "hs_all_owner_ids",
        "hs_all_collaborator_owner_ids",
        "hs_user_ids_of_all_notification_followers",
        "hs_user_ids_of_all_owners",
        "hubspot_owner_assigneddate",
    }
)

EXCLUDE_PREFIXES = (
    "hs_v2_",
    "hs_latest_meeting",
    "hs_time_in_",
)


def load_token() -> str:
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


def req(method: str, url: str, body: dict | None = None, token: str = "") -> dict:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode() or "{}"
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url} -> {e.code}\n{e.read().decode()}") from e


def is_blank(val) -> bool:
    if val is None:
        return True
    if isinstance(val, str):
        return len(val.strip()) == 0
    return False


def property_excluded(name: str, meta: dict) -> bool:
    if name in EXCLUDE_NAMES:
        return True
    if any(name.startswith(p) for p in EXCLUDE_PREFIXES):
        return True
    if meta.get("calculated"):
        return True
    if meta.get("modificationMetadata", {}).get("readOnlyValue"):
        return True
    return False


def fetch_property_metadata(token: str) -> list[dict]:
    return req("GET", "https://api.hubapi.com/crm/v3/properties/deals", token=token)[
        "results"
    ]


def batch_read_deal(deal_id: str, names: list[str], token: str) -> dict:
    """Chunk batch read to stay under request size limits."""
    props: dict = {}
    chunk_size = 100
    for i in range(0, len(names), chunk_size):
        chunk = names[i : i + chunk_size]
        body = {"properties": chunk, "inputs": [{"id": deal_id}]}
        out = req(
            "POST",
            "https://api.hubapi.com/crm/v3/objects/deals/batch/read",
            body,
            token,
        )
        props.update(out["results"][0]["properties"])
    return props


def build_patch(
    props_a: dict, props_b: dict, writable_names: set[str]
) -> dict[str, str]:
    patch: dict[str, str] = {}
    for name in sorted(writable_names):
        if name in EXCLUDE_NAMES or any(name.startswith(p) for p in EXCLUDE_PREFIXES):
            continue
        va, vb = props_a.get(name), props_b.get(name)
        if is_blank(va) and not is_blank(vb):
            # HubSpot expects string values for PATCH
            patch[name] = str(vb) if vb is not None else ""
    return patch


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deal-a", default=DEFAULT_DEAL_A)
    parser.add_argument("--deal-b", default=DEFAULT_DEAL_B)
    parser.add_argument("--dry-run", action="store_true", help="Print patch only (default if no action)")
    parser.add_argument("--patch", action="store_true", help="PATCH deal A with blank fills")
    parser.add_argument(
        "--merge",
        action="store_true",
        help="POST merge B into A (run after --patch or use --merge-only)",
    )
    parser.add_argument(
        "--merge-only",
        action="store_true",
        help="Only run merge API (skip property diff / patch)",
    )
    args = parser.parse_args()

    token = load_token()

    if args.merge_only:
        body = {
            "objectIdToMerge": str(args.deal_b),
            "primaryObjectId": str(args.deal_a),
        }
        out = req(
            "POST",
            "https://api.hubapi.com/crm/v3/objects/deals/merge",
            body,
            token,
        )
        print(json.dumps(out, indent=2)[:6000])
        new_id = out.get("id") or (out.get("properties") or {}).get("hs_object_id")
        if new_id:
            print(f"\nSurviving deal id: {new_id}")
        return

    meta_list = fetch_property_metadata(token)
    writable_names: set[str] = set()
    for p in meta_list:
        name = p["name"]
        if property_excluded(name, p):
            continue
        writable_names.add(name)

    names_sorted = sorted(writable_names)
    props_a = batch_read_deal(args.deal_a, names_sorted, token)
    props_b = batch_read_deal(args.deal_b, names_sorted, token)

    patch = build_patch(props_a, props_b, writable_names)

    print(f"Deal A: {args.deal_a}  Deal B: {args.deal_b}")
    print(f"Writable properties considered: {len(writable_names)}")
    print(f"Properties to copy (B -> A where A blank): {len(patch)}\n")

    for k in sorted(patch.keys()):
        v = patch[k]
        disp = v if len(v) <= 100 else v[:97] + "..."
        print(f"  {k} = {disp!r}")

    if not args.patch and not args.merge:
        print("\n(--dry-run / no action) Use --patch to apply, then --merge to merge deals.")
        return

    if args.patch:
        if not patch:
            print("\nNo properties to PATCH.")
        else:
            req(
                "PATCH",
                f"https://api.hubapi.com/crm/v3/objects/deals/{args.deal_a}",
                {"properties": patch},
                token,
            )
            print(f"\nPATCHed deal {args.deal_a} with {len(patch)} properties.")

    if args.merge:
        body = {
            "objectIdToMerge": str(args.deal_b),
            "primaryObjectId": str(args.deal_a),
        }
        out = req(
            "POST",
            "https://api.hubapi.com/crm/v3/objects/deals/merge",
            body,
            token,
        )
        new_id = out.get("id", out.get("properties", {}).get("hs_object_id"))
        print("\nMerge API response:")
        print(json.dumps(out, indent=2)[:4000])
        if new_id:
            print(f"\nSurviving deal id (use in HubSpot): {new_id}")


if __name__ == "__main__":
    main()
