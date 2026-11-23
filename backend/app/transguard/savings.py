"""What each night is worth: penalties at stake before acting, and money saved once gaps are filled.

Every figure comes from four assumptions that anyone can change on screen. A likely no-show counts at its chance
of not showing (a 61% risk counts as 61% of the penalty); an open post counts in full.
"""

import json

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db import connect, fetch_all, fetch_one
from app.transguard.seed import TODAY

router = APIRouter(prefix="/transguard", tags=["transguard"])

SHIFT_HOURS = 12


class Assumptions(BaseModel):
    penalty_aed: int = Field(1000, ge=0, le=100_000, description="Penalty for an uncovered 12-hour post")
    overtime_rate_aed: float = Field(32, ge=0, le=1000, description="Overtime cost per hour")
    supervisor_minutes: int = Field(25, ge=0, le=600, description="Supervisor phone time to cover one gap the usual way")
    supervisor_rate_aed: float = Field(60, ge=0, le=2000, description="Supervisor cost per hour")


DEFAULTS = Assumptions()


def assumptions() -> Assumptions:
    row = fetch_one("select value from transguard.setting where key = 'savings'")
    return Assumptions(**row["value"]) if row else DEFAULTS


def _gap_value(a: Assumptions, risk: float | None, overtime_hours: float) -> dict:
    """The value of filling one gap with the optimiser instead of the usual way (a guard on a double shift)."""
    posts = a.penalty_aed * (1.0 if risk is None else risk)
    overtime = SHIFT_HOURS * a.overtime_rate_aed - overtime_hours * a.overtime_rate_aed
    supervisor = a.supervisor_minutes / 60 * a.supervisor_rate_aed
    return {"posts": posts, "overtime": overtime, "supervisor": supervisor}


def _sum(values: list[dict], a: Assumptions) -> dict:
    posts = sum(v["posts"] for v in values)
    overtime = sum(v["overtime"] for v in values)
    supervisor = sum(v["supervisor"] for v in values)
    return {
        "filled": len(values),
        "posts_aed": round(posts),
        "overtime_aed": round(overtime),
        "supervisor_minutes": len(values) * a.supervisor_minutes,
        "supervisor_aed": round(supervisor),
        "total_aed": round(posts + overtime + supervisor),
    }


def estimate(assignments: list[dict]) -> int:
    """Saving a plan will make before it is approved (used by the Fill all gaps panel)."""
    a = assumptions()
    values = [_gap_value(a, p.get("noshow_risk"), p["candidate"]["overtime_hours"]) for p in assignments]
    return _sum(values, a)["total_aed"]


@router.get("/savings")
def savings():
    from app.transguard.router import gaps  # imported here: the router imports this module for `estimate`

    a = assumptions()
    open_now = gaps()
    at_stake = sum(a.penalty_aed * (1.0 if g["kind"] == "vacancy" else g["noshow_risk"]) for g in open_now)
    filled = fetch_all("select replaced_risk, overtime_hours from transguard.shift where source = 'backfill' and shift_date = %s", (TODAY,))
    values = [_gap_value(a, f["replaced_risk"], f["overtime_hours"]) for f in filled]
    return {
        "at_stake": {"posts": len(open_now), "aed": round(at_stake)},
        "saved": _sum(values, a),
        "assumptions": a.model_dump(),
        "defaults": DEFAULTS.model_dump(),
    }


@router.put("/savings/assumptions")
def set_assumptions(body: Assumptions):
    with connect() as conn:
        conn.execute(
            "insert into transguard.setting values ('savings', %s) on conflict (key) do update set value = excluded.value",
            (json.dumps(body.model_dump()),),
        )
    return savings()
