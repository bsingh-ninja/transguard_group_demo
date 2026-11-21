"""Smoke test for a running Transguard API (used by CI; also runs against a local demo).

Usage: python scripts/smoke.py [base_url]   (default http://127.0.0.1:8002)
Checks tonight's seeded scenario after a fresh seed or `POST /transguard/reset`. Read-only:
it plans but never assigns. The assistant and triage need Gemini and are not called.
"""

import json
import sys
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8002").rstrip("/")


def call(path, body=None, method=None):
    req = urllib.request.Request(
        BASE + path, data=None if body is None else json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method=method
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def check(name, ok):
    print(("ok   " if ok else "FAIL ") + name)
    if not ok:
        sys.exit(1)


check("health", call("/health") == {"status": "ok"})
t = call("/transguard/overview")["totals"]
check("120 sites, 702 posts, 698 assigned", (t["sites"], t["required"], t["assigned"]) == (120, 702, 698))
check("4 open posts, 3 likely no-shows", (t["vacancies"], t["at_risk"]) == (4, 3))
sites = call("/transguard/sites/list")
check("site list for the new fault report form, with site types", len(sites) == 120 and all(s["type"] for s in sites))
best = call("/transguard/backfill/S003")["candidates"][0]
m = call(f"/transguard/backfill/S003/message/{best['id']}")  # translated by Gemini when a key is set, English otherwise
check("message preview before approving", m["language"] == best["language"] and best["name"].split()[0] in m["text_en"])
risky = [g for g in call("/transguard/gaps") if g["kind"] == "at_risk"]
explained = all(g["reasons"] for g in risky) and risky[0]["reasons"][0]["key"] == "absence"
check("each likely no-show explains why, biggest reason first", explained)
s = call("/transguard/savings")
money = (s["at_stake"]["posts"], s["at_stake"]["aed"], s["saved"]["total_aed"])
check("money: 7 posts and AED 5,520 at stake, nothing saved yet", money == (7, 5520, 0))
plan = call("/transguard/backfill/plan", {}, "POST")
check("optimiser fills every gap", len(plan["assignments"]) >= 6 and plan["total_overtime_aed"] == 0)
check("the plan says what it saves", plan["estimated_saving_aed"] > 0)
w = call("/transguard/what-if", {"area": "Dubai Marina", "guards": 40, "female_guards": 6, "first_aid": 10, "start": "2026-12-01"})
check(
    "new contract: 28 covered, 12 to hire, 2 short on female guards", (w["covered"], w["hiring_gap"], w["female_shortfall"]) == (28, 12, 2)
)
print("Transguard API smoke test passed")
