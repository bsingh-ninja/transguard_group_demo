"""Plain-language reasons behind each no-show prediction, read straight from the model.

The model is a logistic regression on standardised features, so each feature's push on the risk is z * coef.
Days since payday is the same for every guard tonight, so it is never shown as a reason.
"""

import numpy as np

from app.db import fetch_one
from app.transguard.seed import ACCOMMODATION, features_row, km, predict

SHOWN = {"absence_rate_90d": "absence", "commute_km": "commute", "consecutive_nights": "nights", "overtime_hours_week": "overtime"}
MIN_PUSH = 0.15  # smaller pushes are not worth a supervisor's attention

_MODEL: dict | None = None


def noshow_model() -> dict:
    """The trained model saved by the seed. Reset reuses the same model, so it is read once per process."""
    global _MODEL
    if _MODEL is None:
        _MODEL = fetch_one("select params from transguard.model where name = 'noshow'")["params"]
    return _MODEL


def commute_km(worker, site) -> float:
    acc = ACCOMMODATION[worker["accommodation_id"]]
    return km(site["lat"], site["lon"], acc[1], acc[2])


def risk(worker, site) -> float:
    return predict(noshow_model(), features_row(worker, commute_km(worker, site)))


def explain(worker, site, limit: int = 3) -> list[dict]:
    """The reasons that push this guard's risk up, biggest first: {key, value, typical, weight}.
    `typical` is the average guard; `weight` is each reason's share of the shown push (0 to 1)."""
    m = noshow_model()
    row = features_row(worker, commute_km(worker, site))
    push = (np.array(row) - np.array(m["mean"])) / np.array(m["std"]) * np.array(m["coef"])
    out = []
    for name, value, typical, p in zip(m["features"], row, m["mean"], push, strict=True):
        key = SHOWN.get(name)
        if key and p > MIN_PUSH:
            digits = 3 if key == "absence" else 1
            out.append({"key": key, "value": round(float(value), digits), "typical": round(float(typical), digits), "push": float(p)})
    out.sort(key=lambda r: -r["push"])
    out = out[:limit]
    total = sum(r["push"] for r in out) or 1.0
    for r in out:
        r["weight"] = round(r.pop("push") / total, 3)
    return out
