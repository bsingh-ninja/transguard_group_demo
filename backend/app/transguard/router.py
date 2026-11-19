"""Transguard Workforce Intelligence API: tonight's coverage, no-show risk, backfill, what-if."""
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from ortools.sat.python import cp_model
from pydantic import BaseModel

from app.db import connect, fetch_all, fetch_one
from app.llm import client, generate_text
from app.transguard.seed import ACCOMMODATION, AREAS, NIGHT_END, NIGHT_START, TODAY, km

router = APIRouter(prefix="/transguard", tags=["transguard"])

RISK_THRESHOLD = 0.35
MAX_WEEKLY_HOURS = 60
MIN_REST_HOURS = 12
SHIFT_HOURS = 12
OVERTIME_RATE_AED = 32  # simulated overtime cost per hour above 48 h/week


def _site_status(required: int, assigned: int, at_risk: int) -> str:
    if assigned < required:
        return "short"
    return "at_risk" if at_risk else "covered"


@router.get("/overview")
def overview():
    sites = fetch_all("""
        select s.*, count(sh.id)::int as assigned,
               count(sh.id) filter (where sh.noshow_risk > %(r)s)::int as at_risk,
               coalesce(sum(sh.noshow_risk), 0)::float as expected_noshows
        from transguard.site s left join transguard.shift sh on sh.site_id = s.id and sh.shift_date = %(d)s
        group by s.id order by s.name""", {"r": RISK_THRESHOLD, "d": TODAY})
    for s in sites:
        s["vacancies"] = max(0, s["night_required"] - s["assigned"])
        s["status"] = _site_status(s["night_required"], s["assigned"], s["at_risk"])
    required = sum(s["night_required"] for s in sites)
    assigned = sum(min(s["assigned"], s["night_required"]) for s in sites)
    expected = sum(s["expected_noshows"] for s in sites)
    workforce = fetch_one("""
        select count(*)::int total, count(*) filter (where status = 'active')::int active,
               count(*) filter (where licence_expiry between %(d)s and %(d)s::date + 30)::int licences_expiring
        from transguard.worker""", {"d": TODAY})
    return {
        "date": TODAY.isoformat(), "shift": "Night shift, 19:00 to 07:00",
        "totals": {"sites": len(sites), "required": required, "assigned": assigned,
                   "vacancies": sum(s["vacancies"] for s in sites),
                   "at_risk": sum(s["at_risk"] for s in sites),
                   "coverage_pct": round(assigned / required * 100, 1),
                   "expected_coverage_pct": round((assigned - expected) / required * 100, 1)},
        "workforce": workforce,
        "sites": sites,
        "accommodation": [{"name": a[0], "lat": a[1], "lon": a[2]} for a in ACCOMMODATION],
    }


@router.get("/sites/{site_id}")
def site(site_id: str):
    s = fetch_one("select * from transguard.site where id = %s", (site_id,))
    if not s:
        raise HTTPException(404, "Unknown site")
    guards = fetch_all("""
        select sh.id as shift_id, sh.noshow_risk, sh.source, w.id, w.name, w.nationality, w.language, w.gender, w.role,
               w.skills, w.consecutive_nights, w.weekly_hours, w.absence_rate, a.name as accommodation, a.lat as acc_lat, a.lon as acc_lon
        from transguard.shift sh join transguard.worker w on w.id = sh.worker_id
        join transguard.accommodation a on a.id = w.accommodation_id
        where sh.site_id = %s and sh.shift_date = %s order by sh.noshow_risk desc""", (site_id, TODAY))
    for g in guards:
        g["commute_km"] = round(km(s["lat"], s["lon"], g.pop("acc_lat"), g.pop("acc_lon")), 1)
        g["risk_reasons"] = _risk_reasons(g)
    return {"site": s, "guards": guards, "vacancies": max(0, s["night_required"] - len(guards))}


def _risk_reasons(g) -> list[str]:
    reasons = []
    if g["absence_rate"] > 0.08:
        reasons.append(f"Missed {g['absence_rate']:.0%} of shifts in the last 90 days")
    if g.get("commute_km", 0) > 18:
        reasons.append(f"Long commute ({g['commute_km']:.0f} km)")
    if g["consecutive_nights"] >= 5:
        reasons.append(f"{g['consecutive_nights']} nights in a row")
    if g["weekly_hours"] > 54:
        reasons.append(f"{g['weekly_hours']} hours this week")
    return reasons


@router.get("/gaps")
def gaps():
    """Every open slot tonight: vacancies plus shifts whose guard is likely not to show."""
    rows = overview()["sites"]
    out = []
    for s in rows:
        for i in range(s["vacancies"]):
            out.append({"key": f"{s['id']}:v{i}", "kind": "vacancy", "site_id": s["id"], "site": s["name"], "area": s["area"]})
    risky = fetch_all("""
        select sh.id as shift_id, sh.noshow_risk, s.id as site_id, s.name as site, s.area, w.name as worker, w.id as worker_id
        from transguard.shift sh join transguard.site s on s.id = sh.site_id join transguard.worker w on w.id = sh.worker_id
        where sh.shift_date = %s and sh.noshow_risk > %s order by sh.noshow_risk desc""", (TODAY, RISK_THRESHOLD))
    for r in risky:
        out.append({"key": f"{r['site_id']}:s{r['shift_id']}", "kind": "at_risk", **r})
    return out


def _candidates(site_row, exclude: set[str] = frozenset(), limit: int = 5, need_female: bool = False):
    """Eligible stand-by guards for one slot, ranked by travel, reliability and overtime cost."""
    rows = fetch_all("""
        select w.*, a.name as accommodation, a.lat as acc_lat, a.lon as acc_lon
        from transguard.worker w join transguard.accommodation a on a.id = w.accommodation_id
        where w.status = 'active' and w.licence_expiry > %(d)s
          and w.last_shift_end <= %(latest_end)s
          and w.weekly_hours + %(h)s <= %(max_h)s
          and not exists (select 1 from transguard.shift sh where sh.worker_id = w.id and sh.shift_date = %(d)s)""",
        {"d": TODAY, "latest_end": NIGHT_START - timedelta(hours=MIN_REST_HOURS), "h": SHIFT_HOURS, "max_h": MAX_WEEKLY_HOURS})
    out = []
    for w in rows:
        if w["id"] in exclude or (need_female and w["gender"] != "F"):
            continue
        dist = km(site_row["lat"], site_row["lon"], w["acc_lat"], w["acc_lon"])
        overtime_h = max(0, w["weekly_hours"] + SHIFT_HOURS - 48) - max(0, w["weekly_hours"] - 48)
        cost = dist * 1.0 + w["absence_rate"] * 120 + overtime_h * 1.5
        out.append({
            "id": w["id"], "name": w["name"], "nationality": w["nationality"], "language": w["language"], "gender": w["gender"],
            "role": w["role"], "skills": w["skills"], "accommodation": w["accommodation"], "commute_km": round(dist, 1),
            "weekly_hours": w["weekly_hours"], "overtime_hours": overtime_h, "overtime_cost_aed": overtime_h * OVERTIME_RATE_AED,
            "reliability_pct": round((1 - w["absence_rate"]) * 100, 1),
            "licence_expiry": w["licence_expiry"].isoformat(),
            "why": [f"{dist:.0f} km from {w['accommodation']}", f"Rested since {w['last_shift_end']:%a %H:%M}",
                    f"Licence valid to {w['licence_expiry']:%d %b %Y}", f"Shows up for {(1 - w['absence_rate']):.0%} of shifts"],
            "_cost": cost,
        })
    out.sort(key=lambda c: c["_cost"])
    for c in out:
        c["score"] = round(c.pop("_cost"), 1)
    return out[:limit] if limit else out


@router.get("/backfill/{site_id}")
def backfill_candidates(site_id: str):
    s = fetch_one("select * from transguard.site where id = %s", (site_id,))
    if not s:
        raise HTTPException(404, "Unknown site")
    return {"site": s, "candidates": _candidates(s)}


@router.post("/backfill/plan")
def backfill_plan():
    """Fill every gap tonight at once with OR-Tools CP-SAT: minimise total travel, unreliability and overtime."""
    open_slots = gaps()
    if not open_slots:
        return {"assignments": [], "status": "nothing to fill"}
    sites = {s["id"]: s for s in fetch_all("select * from transguard.site")}
    pools = {slot["key"]: _candidates(sites[slot["site_id"]], limit=25) for slot in open_slots}
    model = cp_model.CpModel()
    x = {}
    for slot in open_slots:
        for c in pools[slot["key"]]:
            x[slot["key"], c["id"]] = model.NewBoolVar(f"x_{slot['key']}_{c['id']}")
        model.AddExactlyOne(x[slot["key"], c["id"]] for c in pools[slot["key"]])
    by_worker: dict[str, list] = {}
    for (k, wid), v in x.items():
        by_worker.setdefault(wid, []).append(v)
    for vs in by_worker.values():
        model.AddAtMostOne(vs)  # one guard covers one slot
    model.Minimize(sum(int(c["score"] * 10) * x[slot["key"], c["id"]] for slot in open_slots for c in pools[slot["key"]]))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise HTTPException(409, "No feasible plan for tonight's gaps")
    plan = []
    for slot in open_slots:
        chosen = next(c for c in pools[slot["key"]] if solver.Value(x[slot["key"], c["id"]]))
        plan.append({**slot, "candidate": chosen})
    return {"assignments": plan, "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
            "total_commute_km": round(sum(p["candidate"]["commute_km"] for p in plan), 1),
            "total_overtime_aed": sum(p["candidate"]["overtime_cost_aed"] for p in plan),
            "solve_ms": round(solver.WallTime() * 1000)}


class Assignment(BaseModel):
    site_id: str
    worker_id: str
    replaces_shift_id: int | None = None


LOCAL_TEMPLATES = {
    "English": "Hello {name}, you are assigned tonight to {site} ({area}), 19:00 to 07:00. Transport leaves {acc} at 17:45. Reply YES to confirm.",
    "Arabic": "مرحباً {name}، تم تكليفك الليلة في {site} ({area})، من 19:00 إلى 07:00. تغادر الحافلة من {acc} الساعة 17:45. أرسل نعم للتأكيد.",
}


def _message(worker, site_row) -> dict:
    acc = ACCOMMODATION[worker["accommodation_id"]][0]
    text_en = LOCAL_TEMPLATES["English"].format(name=worker["name"].split()[0], site=site_row["name"], area=site_row["area"], acc=acc)
    local, by = text_en, "template"
    if worker["language"] == "Arabic":
        local = LOCAL_TEMPLATES["Arabic"].format(name=worker["name"].split()[0], site=site_row["name"], area=site_row["area"], acc=acc)
    elif worker["language"] != "English" and client() is not None:
        try:
            local = generate_text(text_en, f"Translate this shift notification into {worker['language']} for a security guard. "
                                           "Keep names, place names, times and the word YES unchanged. Output only the translation.")
            by = "gemini"
        except RuntimeError:
            local = text_en
    return {"language": worker["language"], "text_local": local, "text_en": text_en, "translated_by": by}


@router.post("/backfill/assign")
def assign(a: Assignment):
    s = fetch_one("select * from transguard.site where id = %s", (a.site_id,))
    w = fetch_one("select * from transguard.worker where id = %s", (a.worker_id,))
    if not s or not w:
        raise HTTPException(404, "Unknown site or worker")
    if a.worker_id not in {c["id"] for c in _candidates(s, limit=0)}:
        raise HTTPException(409, f"{w['name']} is no longer eligible for tonight (already rostered, resting or over hours)")
    msg = _message(w, s)
    with connect() as conn:
        if a.replaces_shift_id:
            conn.execute("delete from transguard.shift where id = %s and site_id = %s", (a.replaces_shift_id, a.site_id))
        conn.execute("""insert into transguard.shift (site_id, worker_id, shift_date, period, starts, ends, noshow_risk, source)
                        values (%s,%s,%s,'night',%s,%s,%s,'backfill')""",
                     (a.site_id, a.worker_id, TODAY, NIGHT_START, NIGHT_END, round(w["absence_rate"], 4)))
        conn.execute("update transguard.worker set weekly_hours = weekly_hours + %s where id = %s", (SHIFT_HOURS, a.worker_id))
        conn.execute("insert into transguard.message (worker_id, language, text_en, text_local) values (%s,%s,%s,%s)",
                     (a.worker_id, msg["language"], msg["text_en"], msg["text_local"]))
    return {"assigned": {"worker": w["name"], "site": s["name"]}, "message": msg}


class WhatIf(BaseModel):
    area: str
    guards: int
    start: str = "2026-12-01"
    female_guards: int = 0
    first_aid: int = 0


@router.post("/what-if")
def what_if(q: WhatIf):
    """Can we staff a new contract from the people we have? CP-SAT picks the best crew; the rest is a hiring gap."""
    if q.area not in AREAS:
        raise HTTPException(400, f"Unknown area. Choose one of: {', '.join(AREAS)}")
    em, lat, lon = AREAS[q.area]
    pool = fetch_all("""
        select w.*, a.name as accommodation, a.lat as acc_lat, a.lon as acc_lon
        from transguard.worker w join transguard.accommodation a on a.id = w.accommodation_id
        where w.status = 'bench' and w.licence_expiry > %s::date""",
        (q.start,))
    for w in pool:
        w["commute_km"] = km(lat, lon, w["acc_lat"], w["acc_lon"])
    pool = [w for w in pool if w["commute_km"] <= 45]  # same emirate, reachable by the company bus
    model = cp_model.CpModel()
    pick = {w["id"]: model.NewBoolVar(w["id"]) for w in pool}
    model.Add(sum(pick.values()) <= q.guards)
    model.Add(sum(pick[w["id"]] for w in pool if w["gender"] == "F") >= min(q.female_guards, sum(1 for w in pool if w["gender"] == "F")))
    model.Add(sum(pick[w["id"]] for w in pool if "first_aid" in w["skills"]) >= min(q.first_aid, sum(1 for w in pool if "first_aid" in w["skills"])))
    # maximise people placed first, then minimise travel and unreliability
    model.Maximize(sum((10000 - int(w["commute_km"] * 20) - int(w["absence_rate"] * 2000)) * pick[w["id"]] for w in pool))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5
    solver.Solve(model)
    crew = [w for w in pool if solver.Value(pick[w["id"]])]
    by_acc: dict[str, int] = {}
    for w in crew:
        by_acc[w["accommodation"]] = by_acc.get(w["accommodation"], 0) + 1
    gap = q.guards - len(crew)
    weekly_hours = 48
    return {
        "request": q.model_dump(), "emirate": em, "available_pool": len(pool),
        "covered": len(crew), "hiring_gap": gap,
        "female": sum(1 for w in crew if w["gender"] == "F"), "first_aid": sum(1 for w in crew if "first_aid" in w["skills"]),
        "female_shortfall": max(0, q.female_guards - sum(1 for w in crew if w["gender"] == "F")),
        "first_aid_shortfall": max(0, q.first_aid - sum(1 for w in crew if "first_aid" in w["skills"])),
        "avg_commute_km": round(sum(w["commute_km"] for w in crew) / len(crew), 1) if crew else None,
        "from_accommodation": sorted(({"name": k, "guards": v} for k, v in by_acc.items()), key=lambda r: -r["guards"]),
        "crew_sample": [{"name": w["name"], "nationality": w["nationality"], "accommodation": w["accommodation"],
                         "commute_km": round(w["commute_km"], 1)} for w in sorted(crew, key=lambda w: w["commute_km"])[:8]],
        "weekly_hours_per_guard": weekly_hours,
        "note": "Simulated workforce. Pool: unassigned (bench) guards, licensed on the start date, within 45 km.",
    }


@router.post("/reset")
def reset():
    from app.transguard.seed import seed
    seed()
    return {"status": "reset"}


@router.get("/model")
def model_card():
    m = fetch_one("select params from transguard.model where name = 'noshow'")
    return m["params"] if m else {}
