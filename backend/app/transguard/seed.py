"""Seed the `transguard` schema: simulated sites, guards, tonight's roster and a trained no-show model.

Everything here is simulated (fictional site and worker names); only the area names and the
brand are real. Run: .venv/bin/python -m app.transguard.seed   (deterministic: fixed seed)
"""
import json
import math
import random
from datetime import date, datetime, timedelta

import numpy as np

from app.db import connect

TODAY = date(2026, 11, 18)
NIGHT_START = datetime(2026, 11, 18, 19, 0)
NIGHT_END = datetime(2026, 11, 19, 7, 0)
PAYDAY = 28  # salaries paid on the 28th

AREAS = {  # area: (emirate, lat, lon)
    "Downtown Dubai": ("Dubai", 25.197, 55.274), "Business Bay": ("Dubai", 25.186, 55.263),
    "DIFC": ("Dubai", 25.212, 55.282), "Dubai Marina": ("Dubai", 25.080, 55.140),
    "JLT": ("Dubai", 25.069, 55.142), "Al Barsha": ("Dubai", 25.113, 55.200),
    "Deira": ("Dubai", 25.271, 55.307), "Al Qusais": ("Dubai", 25.279, 55.374),
    "Dubai Silicon Oasis": ("Dubai", 25.122, 55.380), "Jebel Ali": ("Dubai", 25.011, 55.112),
    "Al Quoz": ("Dubai", 25.140, 55.230), "Airport Freezone": ("Dubai", 25.253, 55.365),
    "Abu Dhabi Downtown": ("Abu Dhabi", 24.466, 54.367), "Al Reem Island": ("Abu Dhabi", 24.495, 54.405),
    "Khalifa City": ("Abu Dhabi", 24.420, 54.575), "Mussafah": ("Abu Dhabi", 24.350, 54.500),
    "Yas Island": ("Abu Dhabi", 24.488, 54.607), "Saadiyat Island": ("Abu Dhabi", 24.540, 54.435),
}
ACCOMMODATION = [  # name, lat, lon
    ("Al Quoz Residence", 25.130, 55.235), ("Jebel Ali Village", 25.000, 55.100),
    ("Muhaisnah Residence", 25.270, 55.420), ("DIP Residence", 24.980, 55.170),
    ("Mussafah Residence", 24.345, 54.495), ("Al Shahama Residence", 24.540, 54.680),
]
SITE_TYPES = {  # type: (label, night guards min, max, share)
    "mall": ("Mall", 8, 14, 0.15), "tower": ("Office Tower", 3, 6, 0.30), "hotel": ("Hotel", 4, 8, 0.15),
    "hospital": ("Hospital", 6, 10, 0.08), "government": ("Government Building", 4, 8, 0.12),
    "bank": ("Bank Branch", 2, 3, 0.10), "residential": ("Residences", 2, 4, 0.10),
}
NATIONALITIES = [  # nationality, language, share, first names, last names
    ("Indian", "Malayalam", 0.20, ["Anil", "Biju", "Rajesh", "Suresh", "Vinod", "Jithin", "Shaji", "Deepa", "Anju"],
     ["Kumar", "Nair", "Pillai", "Menon", "Varghese", "Thomas", "Joseph"]),
    ("Indian", "Hindi", 0.12, ["Rahul", "Amit", "Sanjay", "Vikas", "Manoj", "Priya", "Pooja"],
     ["Sharma", "Singh", "Yadav", "Verma", "Gupta", "Mishra"]),
    ("Pakistani", "Urdu", 0.18, ["Imran", "Bilal", "Usman", "Kashif", "Asif", "Tariq", "Nadia"],
     ["Khan", "Ahmed", "Hussain", "Malik", "Qureshi", "Butt"]),
    ("Nepali", "Nepali", 0.14, ["Ram", "Bikash", "Suman", "Prakash", "Dipak", "Sita", "Gita"],
     ["Gurung", "Thapa", "Rai", "Magar", "Tamang", "Shrestha"]),
    ("Bangladeshi", "Bengali", 0.10, ["Rahim", "Karim", "Jamal", "Shakil", "Rafiq", "Nasrin"],
     ["Hossain", "Rahman", "Islam", "Uddin", "Akter"]),
    ("Filipino", "Tagalog", 0.10, ["Mark", "Jayson", "Rommel", "Arnel", "Maricel", "Joy", "Liza"],
     ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza"]),
    ("Ugandan", "English", 0.08, ["Brian", "Isaac", "Moses", "Ronald", "Esther", "Grace"],
     ["Okello", "Mugisha", "Ssempala", "Nakato", "Kato"]),
    ("Egyptian", "Arabic", 0.08, ["Mohamed", "Ahmed", "Mahmoud", "Mostafa", "Sara", "Mona"],
     ["Hassan", "Ibrahim", "Saeed", "Farouk", "Mansour"]),
]
FEMALE = {"Deepa", "Anju", "Priya", "Pooja", "Nadia", "Sita", "Gita", "Nasrin", "Maricel", "Joy", "Liza",
          "Esther", "Grace", "Sara", "Mona"}
# Planted for the demo: these sites are short tonight
SHORT_SITES = {"Dubai Marina Mall": 2, "Deira Hospital": 1, "Abu Dhabi Downtown Government Building": 1}


def km(a_lat, a_lon, b_lat, b_lon):
    p = math.pi / 180
    h = (math.sin((b_lat - a_lat) * p / 2) ** 2
         + math.cos(a_lat * p) * math.cos(b_lat * p) * math.sin((b_lon - a_lon) * p / 2) ** 2)
    return 2 * 6371 * math.asin(math.sqrt(h))


def nearest_accommodation(lat, lon):
    return min(range(len(ACCOMMODATION)), key=lambda i: km(lat, lon, ACCOMMODATION[i][1], ACCOMMODATION[i][2]))


FEATURES = ["absence_rate_90d", "commute_km", "consecutive_nights", "overtime_hours_week", "days_since_payday"]
TRUE_COEF = np.array([9.0, 0.035, 0.32, 0.06, -0.045])
TRUE_BIAS = -4.2


def features_row(w, commute):
    days_since_payday = (TODAY - date(2026, 10, PAYDAY)).days
    return [w["absence_rate"], commute, w["consecutive_nights"], max(0, w["weekly_hours"] - 48), days_since_payday]


def train_noshow(rng: np.random.Generator):
    """Fit a logistic regression on simulated shift history (200k shifts)."""
    n = 200_000
    X = np.column_stack([
        rng.beta(1.2, 30, n), rng.gamma(2.2, 9, n), rng.integers(0, 7, n),
        np.clip(rng.normal(4, 5, n), 0, 20), rng.integers(0, 31, n),
    ])
    p = 1 / (1 + np.exp(-(X @ TRUE_COEF + TRUE_BIAS)))
    y = (rng.random(n) < p).astype(float)
    mu, sd = X.mean(0), X.std(0)
    Z = (X - mu) / sd
    w, b = np.zeros(Z.shape[1]), 0.0
    for _ in range(400):  # plain gradient descent
        q = 1 / (1 + np.exp(-(Z @ w + b)))
        w -= 0.5 * Z.T @ (q - y) / n
        b -= 0.5 * (q - y).mean()
    q = 1 / (1 + np.exp(-(Z @ w + b)))
    return {"features": FEATURES, "mean": mu.tolist(), "std": sd.tolist(), "coef": w.tolist(), "bias": b,
            "trained_on": n, "base_rate": float(y.mean()), "train_log_loss": float(-np.mean(y * np.log(q) + (1 - y) * np.log(1 - q)))}


def predict(model, row):
    z = (np.array(row) - np.array(model["mean"])) / np.array(model["std"])
    return float(1 / (1 + np.exp(-(z @ np.array(model["coef"]) + model["bias"]))))


DDL = """
drop schema if exists transguard cascade;
create schema transguard;
create table transguard.accommodation (id int primary key, name text, lat float, lon float);
create table transguard.site (
  id text primary key, name text, type text, area text, emirate text, lat float, lon float,
  night_required int, needs_female int, needs_k9 boolean, needs_first_aid boolean);
create table transguard.worker (
  id text primary key, name text, nationality text, language text, gender text, role text,
  licence_expiry date, skills text[], accommodation_id int references transguard.accommodation,
  weekly_hours int, last_shift_end timestamp, consecutive_nights int, absence_rate float,
  status text, phone_last4 text);
create table transguard.shift (
  id serial primary key, site_id text references transguard.site, worker_id text references transguard.worker,
  shift_date date, period text, starts timestamp, ends timestamp, noshow_risk float, source text);
create table transguard.model (name text primary key, params jsonb);
create table transguard.message (
  id serial primary key, worker_id text, language text, text_en text, text_local text, created timestamp default now());
"""


_TRAINED: tuple[dict, dict] | None = None  # (model, rng state after training): reset reuses it, same data


def seed():
    global _TRAINED
    rnd = random.Random(11)
    rng = np.random.default_rng(11)
    if _TRAINED is None:  # training is CPU-heavy (minutes on a small server), so do it once per process
        _TRAINED = (train_noshow(rng), rng.bit_generator.state)
    model = _TRAINED[0]
    rng.bit_generator.state = _TRAINED[1]

    # Sites: spread over areas, fictional names
    sites, counters = [], {}
    types = list(SITE_TYPES)
    weights = [SITE_TYPES[t][3] for t in types]
    area_names = list(AREAS)
    planted = [("Dubai Marina Mall", "mall", "Dubai Marina"), ("Deira Hospital", "hospital", "Deira"),
               ("Abu Dhabi Downtown Government Building", "government", "Abu Dhabi Downtown")]
    for name, typ, area in planted:
        em, lat, lon = AREAS[area]
        sites.append((name, typ, area, em, lat + 0.004, lon - 0.003))
    while len(sites) < 120:
        typ = rnd.choices(types, weights)[0]
        area = rnd.choice(area_names)
        em, lat, lon = AREAS[area]
        counters[(area, typ)] = counters.get((area, typ), 0) + 1
        n = counters[(area, typ)]
        name = f"{area} {SITE_TYPES[typ][0]}" + (f" {n + 1}" if (n > 1 or (area, typ) in {(p[2], p[1]) for p in planted}) else "")
        if any(s[0] == name for s in sites):
            continue
        sites.append((name, typ, area, em, lat + rnd.uniform(-0.018, 0.018), lon + rnd.uniform(-0.018, 0.018)))
    site_rows = []
    for i, (name, typ, area, em, lat, lon) in enumerate(sites):
        lo, hi = SITE_TYPES[typ][1], SITE_TYPES[typ][2]
        req = 12 if name == "Dubai Marina Mall" else rnd.randint(lo, hi)
        site_rows.append({"id": f"S{i + 1:03d}", "name": name, "type": typ, "area": area, "emirate": em, "lat": lat, "lon": lon,
                          "night_required": req, "needs_female": (1 if typ in ("mall", "hospital", "government") else 0),
                          "needs_k9": typ == "mall" and rnd.random() < 0.3, "needs_first_aid": typ in ("hospital", "mall")})

    # Workers
    workers = []
    nat_w = [n[2] for n in NATIONALITIES]
    for i in range(3000):
        nat, lang, _, firsts, lasts = rnd.choices(NATIONALITIES, nat_w)[0]
        first = rnd.choice(firsts)
        gender = "F" if first in FEMALE else "M"
        acc = rnd.choices(range(len(ACCOMMODATION)), [0.22, 0.16, 0.22, 0.12, 0.18, 0.10])[0]
        skills = [s for s, p in (("first_aid", 0.4), ("k9", 0.03), ("cctv", 0.25), ("fire_warden", 0.2)) if rnd.random() < p]
        if lang == "Arabic":
            skills.append("arabic")
        days = rnd.choices([rnd.randint(-8, 0), rnd.randint(1, 30), rnd.randint(31, 720)], [0.01, 0.04, 0.95])[0]
        workers.append({
            "id": f"G{i + 1:04d}", "name": f"{first} {rnd.choice(lasts)}", "nationality": nat, "language": lang,
            "gender": gender, "role": "Supervisor" if rnd.random() < 0.06 else "Security Guard",
            "licence_expiry": TODAY + timedelta(days=days), "skills": skills, "accommodation_id": acc,
            "weekly_hours": rnd.choice([36, 42, 48, 48, 48, 54, 60]), "consecutive_nights": rnd.randint(0, 6),
            "absence_rate": float(min(0.4, rng.beta(1.2, 30))), "status": rnd.choices(["active", "leave", "bench"], [0.889, 0.1, 0.011])[0],
            "phone_last4": f"{rnd.randint(0, 9999):04d}",
        })
    # Day shift today (ends 19:00): these guards cannot take tonight's night shift (rest rule)
    active = [w for w in workers if w["status"] == "active" and w["licence_expiry"] > TODAY]
    rnd.shuffle(active)
    day_crew, pool = active[:900], active[900:]
    for w in day_crew:
        w["last_shift_end"] = datetime(2026, 11, 18, 19, 0)
    for w in workers:
        w.setdefault("last_shift_end", datetime(2026, 11, 18, 7, 0) if w["consecutive_nights"] > 0 else datetime(2026, 11, 17, 7, 0))

    # Tonight's roster: fill each site's night requirement from the pool, nearest accommodation first
    shifts = []
    for s in site_rows:
        need = s["night_required"] - SHORT_SITES.get(s["name"], 0)
        near = sorted(pool, key=lambda w: km(s["lat"], s["lon"], ACCOMMODATION[w["accommodation_id"]][1], ACCOMMODATION[w["accommodation_id"]][2]))
        chosen = []
        females_needed = s["needs_female"]
        for w in near:
            if len(chosen) == need:
                break
            if females_needed and w["gender"] == "F":
                chosen.append(w)
                females_needed -= 1
            elif len(chosen) < need - females_needed:
                chosen.append(w)
        for w in chosen:
            pool.remove(w)
            acc = ACCOMMODATION[w["accommodation_id"]]
            commute = km(s["lat"], s["lon"], acc[1], acc[2])
            w["consecutive_nights"] = max(1, w["consecutive_nights"])
            shifts.append((s["id"], w, commute))
    # Planted: a handful of guards tonight with clearly risky profiles
    risky, seen_areas = [], {"Dubai Marina", "Deira", "Abu Dhabi Downtown"}  # not the sites already short
    area_of = {s["id"]: s["area"] for s in site_rows}
    for sid, w, c in sorted(shifts, key=lambda sh: -sh[2]):
        if c > 12 and area_of[sid] not in seen_areas:
            risky.append(w)
            seen_areas.add(area_of[sid])
        if len(risky) == 6:
            break
    profiles = [(0.24, 6, 60), (0.19, 7, 60), (0.21, 5, 54), (0.17, 6, 60), (0.26, 4, 54), (0.18, 6, 54)]
    for w, (rate, nights, hours) in zip(risky, profiles):
        w["absence_rate"], w["consecutive_nights"], w["weekly_hours"] = rate, nights, hours

    with connect() as conn:
        conn.execute(DDL)
        with conn.cursor() as cur:
            cur.executemany("insert into transguard.accommodation values (%s,%s,%s,%s)",
                            [(i, *a) for i, a in enumerate(ACCOMMODATION)])
            cur.executemany(
                "insert into transguard.site values (%(id)s,%(name)s,%(type)s,%(area)s,%(emirate)s,%(lat)s,%(lon)s,"
                "%(night_required)s,%(needs_female)s,%(needs_k9)s,%(needs_first_aid)s)", site_rows)
            cur.executemany(
                "insert into transguard.worker values (%(id)s,%(name)s,%(nationality)s,%(language)s,%(gender)s,%(role)s,"
                "%(licence_expiry)s,%(skills)s,%(accommodation_id)s,%(weekly_hours)s,%(last_shift_end)s,"
                "%(consecutive_nights)s,%(absence_rate)s,%(status)s,%(phone_last4)s)", workers)
            cur.executemany(
                "insert into transguard.shift (site_id, worker_id, shift_date, period, starts, ends, noshow_risk, source) "
                "values (%s,%s,%s,'night',%s,%s,%s,'roster')",
                [(sid, w["id"], TODAY, NIGHT_START, NIGHT_END, round(predict(model, features_row(w, c)), 4)) for sid, w, c in shifts])
            cur.execute("insert into transguard.model values ('noshow', %s)", (json.dumps(model),))
        from app.transguard.assist import seed_fm  # FM technicians and sample tickets (phase 5)
        seed_fm(conn, random.Random(23))
    print(f"Seeded transguard: {len(site_rows)} sites, {len(workers)} workers, {len(shifts)} night shifts; "
          f"model trained on {model['trained_on']:,} shifts (base rate {model['base_rate']:.1%}).")


if __name__ == "__main__":
    seed()
