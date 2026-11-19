# Owner Meeting: Two Separate Demos

**Decision (2026-11-18):** For the meeting with the owner of Al Hail / Transguard / Medad, we show **two standalone demos**, each its own app in its own company's branding:

| # | Demo | Plan | Brand | Likely owner after the meeting |
|---|---|---|---|---|
| 1 | **Group Portfolio Copilot (Al Hail)** | [04-plan-3-alhail-portfolio-copilot.md](04-plan-3-alhail-portfolio-copilot.md) | Al Hail navy / silver, Manrope | Al Hail board office / group CFO |
| 2 | **Workforce Intelligence (Transguard)** | [03-plan-2-transguard-workforce-ops.md](03-plan-2-transguard-workforce-ops.md) | Transguard red / gold, Open Sans | Transguard operations management |

Plans 1, 4 and 5 are parked in [backup/](backup/) as material if the owner asks "what else?".

## Why separate, not one product
- **Different buyers.** Transguard is a JV with Emirates Group and has its own management team. Each demo should be easy to hand to the people who would own it.
- **Lower risk in the room.** One demo failing doesn't affect the other, and there's no fragile live hand-off between apps.
- **Less build.** No cross-app integration, saving about 3–4 days.
- **Cleaner next steps.** Each demo leads to its own pilot on its own timeline.

What links them is the presenter, not the software. One sentence in between does it: *"Same engineering team, same AI foundation, applied where each business needs it."*

## Meeting running order (~25 minutes)

| Min | Segment | Content |
|---|---|---|
| 0–2 | Intro | Who NinjaTech is; "two short demos, each for one of your businesses" |
| 2–12 | **Demo 1: Al Hail Portfolio Copilot** | Cockpit → board pack drafted live with citations → Arabic question on Egypt exposure → SAMAA covenant drill-down (script in Plan 3) |
| 12–13 | Bridge | The one-sentence link above |
| 13–23 | **Demo 2: Transguard Workforce** | Coverage map → no-show backfill + Malayalam message → 40-guard what-if → FM ticket triage → Urdu voice note (script in Plan 2) |
| 23–25 | Close | Two separate pilot offers (below) and the ask |

The order is a judgment call. Leading with Al Hail speaks to the owner as an investor first. If the owner is more hands-on with Transguard, swap the two demos.

## Two separate pilot offers
1. **Al Hail:** board pack copilot on one real quarter's files, in their cloud tenant or on-prem, over 4–6 weeks.
2. **Transguard:** workforce rostering and backfill in shadow mode for one region or one client cluster, over 6–8 weeks, measuring coverage, overtime and backfill time against their current process.

## Build plan (~5 weeks, 3–4 people, both demos in parallel)

| Week | Workforce (Transguard) | Portfolio Copilot (Al Hail) | Done when |
|---|---|---|---|
| 1 | Shared foundation: monorepo, both themes, agent service, synthetic data kit | (shared) | Both themes render in EN and AR; agent answers from a test tool |
| 2 | Data generator; demand forecast; CP-SAT roster | Entity model, 8 quarters of simulated financials, cockpit UI | Roster feasible in under 60 seconds; cockpit shows 12 businesses |
| 3 | No-show model + backfill; coverage map; what-if; supervisor copilot | Document ingestion; copilot (SQL + RAG) with citations | Backfill in under 3 seconds; 20 portfolio questions answered correctly |
| 4 | FM triage with photos; multilingual worker assistant | Board pack generator (EN + AR); signal monitor; drill-down pages | 8 languages pass the test set; every board-pack line cited |
| 5 | Offline cache, reset button, 3 rehearsals | Arabic native review, offline cache, 3 rehearsals | Each demo runs 3 times in a row without manual fixes |

The apps are separate (`apps/transguard-workforce`, `apps/alhail-portfolio`) and deploy independently. They share only the internal foundation code (UI kit, agent service), which the audience never sees.

**Minimum version (3 weeks)**, if the meeting is sooner:
- **Al Hail:** cockpit + Ask the Portfolio + a pre-generated board pack.
- **Transguard:** coverage map + no-show backfill + what-if.

## Team
| Role | Allocation |
|---|---|
| Tech lead / full-stack | 1.0 FTE |
| ML / optimisation engineer (Transguard forecasts, CP-SAT) | 1.0 FTE |
| LLM / RAG engineer (Al Hail copilot, board pack, multilingual) | 1.0 FTE |
| Product / designer (branding, scripts) | 0.5 FTE |

## Before the meeting
- [ ] Meeting date. This decides between the full 5-week build and the 3-week minimum version.
- [ ] Comfort with showing the Al Hail and Transguard logos (default: private demo, "Prepared for" co-brand).
- [ ] A vector Transguard logo (the website only has a 110 px PNG).
- [ ] Whether Transguard's Launchpad or a guard-management system already covers rostering.
- [ ] Native Arabic reviewer for the Al Hail board pack and both copilots.
- [ ] Prepared answers for "where does our data live?" (UAE-region cloud or on-prem) and "who owns the IP?".
