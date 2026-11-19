"""Transguard phases 4-5: multilingual worker assistant and FM ticket triage (Gemini).

All worker records (payslip, leave, visa, transport) and tickets are simulated and deterministic.
"""
import base64
import json
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from google.genai import errors, types
from pydantic import BaseModel

from app.db import connect, fetch_all, fetch_one
from app.llm import MODEL, NO_KEY_MESSAGE, client, error_message
from app.transguard.seed import ACCOMMODATION, AREAS, TODAY, km

router = APIRouter(prefix="/transguard", tags=["transguard"])

# ---------------------------------------------------------------- seed (called from seed.py)
TRADES = ["HVAC", "Electrical", "Plumbing", "Civil", "Lifts", "Cleaning", "Pest control"]
TECH_NAMES = ["Arun Pillai", "Faisal Khan", "Joel Santos", "Hari Thapa", "Sohel Rana", "Peter Okello", "Mahmoud Adel",
              "Sunil Nair", "Waqar Ali", "Ramon Cruz", "Bishnu Rai", "Nazmul Haque", "Daniel Mugisha", "Tamer Fathy"]
SAMPLE_TICKETS = [
    ("Dubai Marina Mall", "Call centre", "AC unit above food court gate 3 is dripping water onto the floor, cleaners placed a wet-floor sign."),
    ("Deira Hospital", "Email", "Lift 2 in the outpatient block stopped between floors 3 and 4 this morning, no one inside, out of service now."),
    ("Business Bay Office Tower", "Mobile app", "Several ceiling lights flickering in the level 12 corridor, one fully off near the fire exit."),
    ("Al Barsha Hotel", "Call centre", "Guest reports cockroaches in room 418 bathroom. Second report this week on floor 4."),
    ("JLT Office Tower", "Email", "Water leaking under the pantry sink on level 7, small pool forming on the floor."),
    ("Abu Dhabi Downtown Government Building", "Mobile app", "Cracked floor tiles at the main entrance, a visitor almost tripped."),
    ("Dubai Marina Mall", "Call centre", "Parking level P2 near lift lobby has a strong smell and overflowing bins after the weekend."),
    ("Khalifa City Government Building", "Email", "Server room temperature alarm went off twice overnight, room feels warm."),
]

FM_DDL = """
create table transguard.technician (
  id text primary key, name text, trade text, area text, lat float, lon float, available boolean, jobs_today int);
create table transguard.ticket (
  id serial primary key, site_id text references transguard.site, channel text, description text, photo boolean,
  created timestamp, status text, triage jsonb, technician_id text references transguard.technician);
create table transguard.hr_case (id serial primary key, worker_id text, summary text, created timestamp default now());
"""


def seed_fm(conn, rnd: random.Random):
    conn.execute(FM_DDL)
    techs = []
    for i in range(40):
        area = rnd.choice(list(AREAS))
        _, lat, lon = AREAS[area]
        techs.append((f"T{i + 1:03d}", f"{rnd.choice(TECH_NAMES)}", TRADES[i % len(TRADES)], area,
                      lat + rnd.uniform(-0.02, 0.02), lon + rnd.uniform(-0.02, 0.02), rnd.random() > 0.2, rnd.randint(0, 5)))
    with conn.cursor() as cur:
        cur.executemany("insert into transguard.technician values (%s,%s,%s,%s,%s,%s,%s,%s)", techs)
        sites = {r["name"]: r["id"] for r in conn.execute("select id, name from transguard.site").fetchall()}
        rows = []
        for j, (site, channel, text) in enumerate(SAMPLE_TICKETS):
            if site in sites:
                rows.append((sites[site], channel, text, False, datetime(2026, 11, 18, 8, 10) + timedelta(minutes=37 * j), "new"))
        cur.executemany("insert into transguard.ticket (site_id, channel, description, photo, created, status) "
                        "values (%s,%s,%s,%s,%s,%s)", rows)


# ---------------------------------------------------------------- worker records (simulated, deterministic)
def worker_records(worker_id: str) -> dict:
    w = fetch_one("""select w.*, a.name as accommodation from transguard.worker w
                     join transguard.accommodation a on a.id = w.accommodation_id where w.id = %s""", (worker_id,))
    if not w:
        raise HTTPException(404, "Unknown worker")
    rnd = random.Random(worker_id)
    basic = rnd.choice([1650, 1800, 1950, 2100])
    ot_hours = rnd.choice([0, 8, 12, 16, 24])
    shift = fetch_one("""select s.name as site, s.area, sh.starts, sh.ends from transguard.shift sh
                         join transguard.site s on s.id = sh.site_id where sh.worker_id = %s and sh.shift_date = %s""",
                      (worker_id, TODAY))
    visa_exp = TODAY + timedelta(days=rnd.randint(20, 700))
    return {
        "worker": {"id": w["id"], "name": w["name"], "role": w["role"], "language": w["language"], "nationality": w["nationality"]},
        "shift": ({"tonight": True, "site": shift["site"], "area": shift["area"], "starts": f"{shift['starts']:%a %d %b %H:%M}",
                   "ends": f"{shift['ends']:%a %d %b %H:%M}"} if shift else
                  {"tonight": False, "next": f"{(TODAY + timedelta(days=1)):%a %d %b} 19:00, site confirmed by your supervisor"}),
        "transport": {"accommodation": w["accommodation"], "night_bus": "17:45", "day_bus": "05:45", "pickup_point": "Main gate"},
        "payslip": {"month": "October 2026", "paid_on": "28 Oct 2026", "next_pay_date": "28 Nov 2026", "currency": "AED",
                    "basic": basic, "overtime_hours": ot_hours, "overtime_pay": round(ot_hours * 10.5, 2),
                    "food_allowance": 300, "deductions": 0 if rnd.random() > 0.3 else 150,
                    "deduction_reason": None, "net": None},
        "leave": {"annual_leave_days_left": rnd.randint(2, 30), "sick_days_used_this_year": rnd.randint(0, 6),
                  "next_approved_leave": rnd.choice([None, "12 to 26 Jan 2027"])},
        "documents": {"residence_visa_expiry": visa_exp.isoformat(), "emirates_id_expiry": visa_exp.isoformat(),
                      "renewal_status": "Renewal in progress with the PRO team" if (visa_exp - TODAY).days < 60 else "Not due yet",
                      "sira_licence_expiry": w["licence_expiry"].isoformat()},
    }


def _payslip(rec):
    p = rec["payslip"]
    if p["deductions"]:
        p["deduction_reason"] = "Uniform replacement (second set)"
    p["net"] = round(p["basic"] + p["overtime_pay"] + p["food_allowance"] - p["deductions"], 2)
    return p


ASSIST_TOOLS = {
    "get_my_shift": ("Tonight's shift or the next shift: site, area, start and end.", lambda r, a: r["shift"]),
    "get_my_payslip": ("Last payslip: basic, overtime hours and pay, allowances, deductions with reason, net, pay dates.", lambda r, a: _payslip(r)),
    "get_my_leave": ("Annual leave days left, sick days used, next approved leave.", lambda r, a: r["leave"]),
    "get_my_documents": ("Residence visa, Emirates ID and SIRA licence expiry dates and renewal status.", lambda r, a: r["documents"]),
    "get_my_transport": ("Company bus times from the worker's accommodation and the pickup point.", lambda r, a: r["transport"]),
}

ASSIST_SYSTEM = """You are the Transguard worker assistant on a messaging app. You help one security guard with questions \
about their own shift, pay, leave, visa and documents, and transport.
- Always look the answer up with the tools; never guess a date, amount or time.
- Reply in the language of the guard's latest message (Malayalam, Hindi, Urdu, Nepali, Bengali, Tagalog, Arabic or \
English), even if their profile says another language. Use simple, friendly words and short sentences, like a helpful \
supervisor. Keep amounts as numbers with AED.
- For any question about pay, first call get_my_payslip and explain the lines that answer it (basic, overtime, \
allowances, any deduction and its reason, net). Escalate a pay question only if the payslip does not explain it.
- Answer in 1 to 4 short lines. No markdown headings or tables.
- If the guard has a complaint, a problem you cannot solve, or asks for a person, call escalate_to_hr with a one-line \
summary in English, then tell the guard a case was opened and someone from HR will call them.
- The data is simulated for a demonstration; you can say so if asked."""


def _assist_decls():
    decls = [types.FunctionDeclaration(name=n, description=d, parameters_json_schema={"type": "object", "properties": {}})
             for n, (d, _) in ASSIST_TOOLS.items()]
    decls.append(types.FunctionDeclaration(
        name="escalate_to_hr", description="Open an HR case for a person to follow up. Summary in English, one line.",
        parameters_json_schema={"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]}))
    return [types.Tool(function_declarations=decls)]


def reply_language(text: str, profile_language: str) -> str:
    """Language of the latest message, from its script; the profile breaks ties within a script."""
    counts = {"malayalam": 0, "devanagari": 0, "arabic": 0, "bengali": 0, "latin": 0}
    for ch in text:
        o = ord(ch)
        if 0x0D00 <= o <= 0x0D7F:
            counts["malayalam"] += 1
        elif 0x0900 <= o <= 0x097F:
            counts["devanagari"] += 1
        elif 0x0600 <= o <= 0x06FF:
            counts["arabic"] += 1
        elif 0x0980 <= o <= 0x09FF:
            counts["bengali"] += 1
        elif ch.isascii() and ch.isalpha():
            counts["latin"] += 1
    script = max(counts, key=counts.get)
    if script == "malayalam":
        return "Malayalam"
    if script == "bengali":
        return "Bengali"
    if script == "devanagari":
        return "Nepali" if profile_language == "Nepali" else "Hindi"
    if script == "arabic":
        return "Urdu" if profile_language == "Urdu" else "Arabic"
    return "Tagalog or English, whichever the guard used" if profile_language == "Tagalog" else "English"


class AssistRequest(BaseModel):
    worker_id: str
    messages: list[dict]


@router.get("/assistant/workers")
def demo_workers():
    """One rostered guard per language, for the demo picker."""
    rows = fetch_all("""select distinct on (w.language) w.id, w.name, w.language, w.nationality
                        from transguard.worker w join transguard.shift sh on sh.worker_id = w.id and sh.shift_date = %s
                        order by w.language, w.id""", (TODAY,))
    order = ["Malayalam", "Urdu", "Tagalog", "Nepali", "Bengali", "Hindi", "Arabic", "English"]
    return sorted(rows, key=lambda r: order.index(r["language"]) if r["language"] in order else 99)


@router.post("/assistant")
def assistant(req: AssistRequest):
    gemini = client()
    if gemini is None:
        raise HTTPException(503, NO_KEY_MESSAGE)
    rec = worker_records(req.worker_id)
    contents = [types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part.from_text(text=str(m["content"]))])
                for m in req.messages if m.get("content")]
    if not contents or contents[-1].role != "user":
        raise HTTPException(400, "The last message must be from the worker")
    system = ASSIST_SYSTEM + f"\nThe guard is {rec['worker']['name']} ({rec['worker']['role']}, {rec['worker']['nationality']}, "\
                             f"prefers {rec['worker']['language']}). Today is {TODAY:%A %d %B %Y}.\n" \
                             f"The guard's latest message is written in {reply_language(contents[-1].parts[0].text, rec['worker']['language'])}: " \
                             "reply in that language."
    used, case_id = [], None
    try:
        for round_no in range(5):
            mode = types.FunctionCallingConfigMode.ANY if round_no == 0 else types.FunctionCallingConfigMode.AUTO
            r = gemini.models.generate_content(model=MODEL, contents=contents, config=types.GenerateContentConfig(
                system_instruction=system, tools=_assist_decls(),
                tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode=mode)),
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)))
            parts = r.candidates[0].content.parts if r.candidates and r.candidates[0].content else []
            calls = [p.function_call for p in parts if p.function_call]
            if not calls:
                text = "".join(p.text for p in parts if p.text and not p.thought).strip()
                return {"reply": text, "tools": used, "hr_case": case_id}
            contents.append(types.Content(role="model", parts=parts))
            responses = []
            for c in calls:
                used.append(c.name)
                if c.name == "escalate_to_hr":
                    with connect() as conn:
                        case_id = conn.execute("insert into transguard.hr_case (worker_id, summary) values (%s,%s) returning id",
                                               (req.worker_id, (c.args or {}).get("summary", ""))).fetchone()["id"]
                    out = {"case_id": f"HR-{case_id:05d}", "callback": "within 24 hours"}
                else:
                    out = ASSIST_TOOLS[c.name][1](rec, c.args or {})
                responses.append(types.Part(function_response=types.FunctionResponse(id=c.id, name=c.name,
                                                                                    response={"result": json.loads(json.dumps(out, default=str))})))
            contents.append(types.Content(role="user", parts=responses))
        raise HTTPException(502, "The assistant took too many steps; please ask again.")
    except errors.APIError as e:
        raise HTTPException(502, error_message(e)) from e


# ---------------------------------------------------------------- FM ticket triage
TRIAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "trade": {"type": "string", "enum": TRADES},
        "issue": {"type": "string", "description": "Short name of the fault, e.g. 'Condensate leak from AC unit'"},
        "priority": {"type": "string", "enum": ["P1", "P2", "P3", "P4"]},
        "priority_reason": {"type": "string"},
        "safety_risk": {"type": "boolean"},
        "likely_parts": {"type": "array", "items": {"type": "string"}},
        "checklist": {"type": "array", "items": {"type": "string"}, "description": "4-6 first-time-fix steps for the technician"},
        "photo_observations": {"type": "string", "description": "What the photo shows, or empty if no photo"},
    },
    "required": ["trade", "issue", "priority", "priority_reason", "safety_risk", "likely_parts", "checklist", "photo_observations"],
}
SLA_HOURS = {"P1": 1, "P2": 4, "P3": 24, "P4": 72}
TRIAGE_SYSTEM = """You triage facilities-management fault reports for Transguard's integrated FM service in the UAE. \
Classify the trade, name the issue briefly, and set priority: P1 = immediate safety risk or critical service down \
(stuck lift, flooding, fire or electrical hazard, critical cooling); P2 = disrupts operations or could become unsafe soon; \
P3 = normal repair; P4 = cosmetic or planned. Give likely parts and a short first-time-fix checklist. If a photo is \
attached, say what it shows and use it. Base everything only on the report and photo."""


@router.get("/tickets")
def tickets():
    rows = fetch_all("""select t.id, t.channel, t.description, t.photo, t.created, t.status, t.triage,
                               s.name as site, s.area, te.name as technician, te.trade as technician_trade
                        from transguard.ticket t join transguard.site s on s.id = t.site_id
                        left join transguard.technician te on te.id = t.technician_id order by t.created desc""")
    for r in rows:
        r["created"] = f"{r['created']:%H:%M}"
    return rows


class TriageRequest(BaseModel):
    ticket_id: int | None = None
    site_id: str | None = None
    description: str | None = None
    photo_base64: str | None = None
    photo_mime: str | None = None


@router.post("/tickets/triage")
def triage(req: TriageRequest):
    gemini = client()
    if gemini is None:
        raise HTTPException(503, NO_KEY_MESSAGE)
    if req.ticket_id:
        t = fetch_one("select * from transguard.ticket where id = %s", (req.ticket_id,))
        if not t:
            raise HTTPException(404, "Unknown ticket")
        site_id, text = t["site_id"], t["description"]
    else:
        if not (req.site_id and (req.description or req.photo_base64)):
            raise HTTPException(400, "Choose a site and describe the fault or attach a photo")
        site_id, text = req.site_id, req.description or "(no description, see photo)"
    site = fetch_one("select * from transguard.site where id = %s", (site_id,))
    parts = [types.Part.from_text(text=f"Site: {site['name']} ({site['type']}, {site['area']}).\nReport: {text}")]
    if req.photo_base64:
        parts.append(types.Part.from_bytes(data=base64.b64decode(req.photo_base64), mime_type=req.photo_mime or "image/jpeg"))
    try:
        r = gemini.models.generate_content(model=MODEL, contents=[types.Content(role="user", parts=parts)],
                                           config=types.GenerateContentConfig(system_instruction=TRIAGE_SYSTEM,
                                                                              response_mime_type="application/json",
                                                                              response_json_schema=TRIAGE_SCHEMA))
    except errors.APIError as e:
        raise HTTPException(502, error_message(e)) from e
    result = json.loads(r.text)
    # Assign the nearest available technician with the right trade, fewest jobs breaking ties
    techs = fetch_all("select * from transguard.technician where trade = %s and available", (result["trade"],))
    best = min(techs, key=lambda x: (km(site["lat"], site["lon"], x["lat"], x["lon"]) + x["jobs_today"] * 3), default=None)
    sla = SLA_HOURS[result["priority"]]
    result |= {"sla_hours": sla, "due_by": f"{(datetime(2026, 11, 18, 10, 0) + timedelta(hours=sla)):%a %H:%M}", "site": site["name"]}
    if best:
        dist = km(site["lat"], site["lon"], best["lat"], best["lon"])
        result["technician"] = {"id": best["id"], "name": best["name"], "trade": best["trade"], "area": best["area"],
                                "distance_km": round(dist, 1), "eta_min": int(10 + dist * 2.2), "jobs_today": best["jobs_today"]}
    with connect() as conn:
        if req.ticket_id:
            conn.execute("update transguard.ticket set triage = %s, status = 'triaged' where id = %s", (json.dumps(result), req.ticket_id))
        else:
            row = conn.execute("""insert into transguard.ticket (site_id, channel, description, photo, created, status, triage)
                                  values (%s,'Supervisor app',%s,%s,%s,'triaged',%s) returning id""",
                               (site_id, text, bool(req.photo_base64), datetime(2026, 11, 18, 10, 0), json.dumps(result))).fetchone()
            result["ticket_id"] = row["id"]
    return result


class Dispatch(BaseModel):
    ticket_id: int
    technician_id: str


@router.post("/tickets/dispatch")
def dispatch(d: Dispatch):
    with connect() as conn:
        n = conn.execute("update transguard.ticket set status = 'dispatched', technician_id = %s where id = %s",
                         (d.technician_id, d.ticket_id)).rowcount
        conn.execute("update transguard.technician set jobs_today = jobs_today + 1 where id = %s", (d.technician_id,))
    if not n:
        raise HTTPException(404, "Unknown ticket")
    return {"status": "dispatched"}


@router.get("/sites/list")
def site_list():
    return fetch_all("select id, name, area from transguard.site order by name")
